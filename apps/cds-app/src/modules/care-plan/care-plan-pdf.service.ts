import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logger } from '@hs/observability';
import { db } from '@hs/infra';
import type { IStorage } from '@hs/infra';
import { STORAGE_TOKEN } from '../../services/services.module';
import {
  createPdfContext,
  renderBrandedHeader,
  renderSectionTitle,
  renderDivider,
  renderKeyValueGrid,
  renderCdsCards,
  renderDisclaimer,
} from './pdf-builder';

export interface PdfExportResult {
  downloadUrl: string;
  storageKey: string;
  expiresAt: string;
}

@Injectable()
export class CarePlanPdfService {
  constructor(
    @Inject(STORAGE_TOKEN) private readonly storage: IStorage,
    private readonly config: ConfigService,
  ) {}

  async exportPdf(carePlanId: string, applicationId: string): Promise<PdfExportResult> {
    const carePlan = await db.getClient().carePlan.findFirst({
      where: { id: carePlanId, applicationId, isDeleted: false },
    });
    if (!carePlan) throw new NotFoundException('Care plan not found');

    // Check cached PDF
    const metadata = (carePlan.metadata as Record<string, any>) || {};
    const ttl = this.config.get<number>('app.pdfSignedUrlTtl')!;

    if (metadata.pdfStorageKey && metadata.pdfExpiresAt) {
      const expiresAt = new Date(metadata.pdfExpiresAt);
      if (expiresAt > new Date()) {
        const downloadUrl = await this.storage.getSignedUrl(metadata.pdfStorageKey, ttl);
        return { downloadUrl, storageKey: metadata.pdfStorageKey, expiresAt: metadata.pdfExpiresAt };
      }
    }

    // Generate → Upload → Sign → Cache
    const pdfBytes = await this.buildCarePlanPdf(carePlan);
    const storageKey = this.buildStorageKey(carePlan);

    await this.storage.upload(storageKey, Buffer.from(pdfBytes), 'application/pdf');
    const downloadUrl = await this.storage.getSignedUrl(storageKey, ttl);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    await db.getClient().carePlan.update({
      where: { id: carePlanId },
      data: {
        metadata: {
          ...metadata,
          pdfStorageKey: storageKey,
          pdfGeneratedAt: new Date().toISOString(),
          pdfExpiresAt: expiresAt,
        },
      },
    });

    logger.info('Care plan PDF exported', { carePlanId, storageKey });
    return { downloadUrl, storageKey, expiresAt };
  }

  async invalidatePdfCache(carePlanId: string): Promise<void> {
    const carePlan = await db.getClient().carePlan.findUnique({
      where: { id: carePlanId },
      select: { metadata: true },
    });
    const metadata = (carePlan?.metadata as Record<string, any>) || {};
    if (!metadata.pdfStorageKey) return;

    this.storage.delete(metadata.pdfStorageKey).catch(() => {});

    await db.getClient().carePlan.update({
      where: { id: carePlanId },
      data: {
        metadata: {
          ...metadata,
          pdfStorageKey: null,
          pdfGeneratedAt: null,
          pdfExpiresAt: null,
        },
      },
    });
  }

  private buildStorageKey(carePlan: any): string {
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9\-_]/g, '_');
    return [
      'care-plans',
      sanitize(carePlan.applicationId),
      sanitize(carePlan.patientFhirId),
      carePlan.id,
      `v${carePlan.version}.pdf`,
    ].join('/');
  }

  /**
   * Compose a care plan PDF using reusable pdf-builder primitives.
   */
  private async buildCarePlanPdf(carePlan: any): Promise<Uint8Array> {
    const { ctx, finalize } = await createPdfContext();

    // Header
    renderBrandedHeader(ctx, 'Clinical Decision Support Report');

    // Patient info
    renderSectionTitle(ctx, 'PATIENT INFORMATION');

    const fields: [string, string][] = [
      ['Patient', carePlan.patientName || carePlan.patientFhirId],
      ['Patient ID', carePlan.patientFhirId],
      ['EHR', carePlan.ehrName],
    ];
    if (carePlan.encounterType) fields.push(['Encounter', carePlan.encounterType]);
    if (carePlan.encounterDate) fields.push(['Encounter Date', new Date(carePlan.encounterDate).toLocaleDateString()]);
    if (carePlan.providerName) fields.push(['Provider', carePlan.providerName]);

    renderKeyValueGrid(ctx, fields);
    renderDivider(ctx);

    // Plan metadata
    renderSectionTitle(ctx, 'CARE PLAN DETAILS');

    const meta: [string, string][] = [
      ['Title', carePlan.title],
      ['Status', carePlan.status],
    ];
    if (carePlan.version > 1) meta.push(['Version', `v${carePlan.version}`]);
    meta.push(['Created', new Date(carePlan.createdAt).toLocaleString()]);

    renderKeyValueGrid(ctx, meta);
    renderDivider(ctx);

    // CDS cards
    renderCdsCards(ctx, carePlan.cards as any[]);

    // Disclaimer
    renderDisclaimer(ctx, carePlan.id);

    return finalize();
  }
}
