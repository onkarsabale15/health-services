import { Controller, Get, Post, Body, Sse, UseGuards, BadRequestException, ConflictException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { interval, Observable, defer, concat, of } from 'rxjs';
import { switchMap, distinctUntilChanged } from 'rxjs/operators';
import { logger } from '@hs/observability';
import { cache } from '@hs/infra';
import { SessionService } from '../../services/session.service';
import { AnalysisService } from './analysis.service';
import { CdsSessionGuard } from '../../guards/session.guard';
import { CurrentSession } from '../../decorators/session.decorator';
import type { CdsSession } from '../../services/session.service';
import type { CdsCard } from '../../engine';

const ANALYSIS_LOCK_TTL = 300; // 5 minutes

class StartAnalysisDto {
  @ApiPropertyOptional({ description: 'ID of the previous care plan to re-analyze' })
  @IsUUID()
  @IsOptional()
  previousCarePlanId?: string;

  @ApiPropertyOptional({
    description: 'Provider instructions for the AI analysis (focus areas, corrections, clinical context)',
  })
  @IsString()
  @IsOptional()
  instructions?: string;
}

@ApiTags('Analysis')
@Controller('analysis')
@UseGuards(CdsSessionGuard)
export class AnalysisController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly analysisService: AnalysisService,
  ) {}

  /** Start AI analysis — fresh or re-analysis, optionally with provider instructions */
  @Post('start')
  @ApiOperation({ summary: 'Start AI care plan analysis' })
  @ApiResponse({ status: 200, description: 'Analysis started' })
  async startAnalysis(@CurrentSession() session: CdsSession, @Body() dto: StartAnalysisDto) {
    const psid = session.providerSession.providerSessionId;
    const pc = session.patientContext;

    if (!pc) throw new BadRequestException('No patient context — re-launch from EHR');

    // Atomic lock prevents concurrent analysis for the same session
    const lockKey = `cds:lock:analysis:${psid}`;
    const acquired = await cache.setNx(lockKey, { startedAt: Date.now() }, ANALYSIS_LOCK_TTL);
    if (!acquired) throw new ConflictException('Analysis already in progress');

    await this.sessionService.updateStatus(psid, 'pending');

    this.analysisService
      .runAsync(psid, {
        previousCarePlanId: dto.previousCarePlanId,
        instructions: dto.instructions,
      })
      .catch((err) => logger.error('CDS analysis failed (async)', err))
      .finally(() => cache.del(lockKey).catch(() => {}));

    return {
      status: 'pending',
      message: dto.previousCarePlanId ? 'Re-analysis started' : 'Analysis started',
      isReanalysis: !!dto.previousCarePlanId,
    };
  }

  /** Poll analysis status — cookie-based, no session ID in URL */
  @Get('status')
  @ApiOperation({ summary: 'Get analysis status and results' })
  @ApiResponse({ status: 200, description: 'Analysis status (and cards if complete)' })
  async getStatus(@CurrentSession() session: CdsSession): Promise<AnalysisStatusEvent> {
    return this.buildStatusEvent(session.providerSession.providerSessionId);
  }

  /**
   * Real-time analysis status via Server-Sent Events.
   *
   * Sends one event immediately on connect (so a returning client sees the
   * current state without polling), then one event each time the status
   * changes. Server-side polls Redis every 2s and emits only on diff —
   * simpler than wiring up Redis pub/sub for what is effectively a per-
   * session signal.
   *
   * Why SSE: cookie auth works out of the box, browsers auto-reconnect on
   * network blip, no extra dependency. Bidirectional WS is overkill since
   * the client never sends through this channel — it uses POST /start.
   */
  @Sse('events')
  @ApiOperation({ summary: 'Real-time analysis status updates (SSE)' })
  events(@CurrentSession() session: CdsSession): Observable<{ data: AnalysisStatusEvent }> {
    const psid = session.providerSession.providerSessionId;

    // Initial event (immediate) followed by a change-detected stream.
    const initial$ = defer(() => this.buildStatusEvent(psid));
    const changes$ = interval(2000).pipe(switchMap(() => defer(() => this.buildStatusEvent(psid))));

    return concat(initial$, changes$).pipe(
      // Suppress no-ops: emit only when status or error message changes.
      distinctUntilChanged((a, b) => a.status === b.status && a.error === b.error),
      switchMap((event) => of({ data: event })),
    );
  }

  private async buildStatusEvent(psid: string): Promise<AnalysisStatusEvent> {
    const session = await this.sessionService.getFullSession(psid);
    const pc = session?.patientContext;
    const status: AnalysisStatusEvent['status'] = pc?.status ?? 'idle';
    let cards: CdsCard[] | undefined;
    if (status === 'complete') {
      const results = await this.sessionService.getResults(psid);
      if (results) cards = results;
    }
    return {
      providerSessionId: psid,
      patientId: pc?.patientId,
      encounterId: pc?.encounterId,
      status,
      cards,
      error: pc?.error,
    };
  }
}

interface AnalysisStatusEvent {
  providerSessionId: string;
  patientId?: string;
  encounterId?: string;
  status: 'idle' | 'pending' | 'analyzing' | 'complete' | 'error';
  cards?: CdsCard[];
  error?: string;
}
