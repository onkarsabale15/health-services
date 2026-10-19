import { Controller, Get, Post, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CdsSessionGuard } from '../../guards/session.guard';
import { CurrentSession } from '../../decorators/session.decorator';
import type { CdsSession } from '../../services/session.service';
import { PatientService } from './patient.service';

/**
 * Patient search and selection for standalone/system modes.
 * Audit tracing is handled automatically by AuditInterceptor (global).
 */
@ApiTags('Patient')
@Controller('patients')
@UseGuards(CdsSessionGuard)
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search patients by name, DOB, or MRN' })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'birthdate', required: false })
  @ApiQuery({ name: 'identifier', required: false, description: 'MRN or other identifier' })
  async search(
    @CurrentSession() session: CdsSession,
    @Query('name') name?: string,
    @Query('birthdate') birthdate?: string,
    @Query('identifier') identifier?: string,
  ) {
    if (!name && !birthdate && !identifier) {
      throw new BadRequestException('At least one search parameter required (name, birthdate, or identifier)');
    }
    return this.patientService.searchPatients(session, { name, birthdate, identifier });
  }

  @Post('select')
  @ApiOperation({ summary: 'Set the current patient context' })
  async select(@CurrentSession() session: CdsSession, @Body() body: { patientId: string }) {
    if (!body.patientId) throw new BadRequestException('patientId is required');
    return this.patientService.selectPatient(session, body.patientId);
  }
}
