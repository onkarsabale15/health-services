import { Injectable } from '@nestjs/common';
import type { CdsCard, CdsSeverity } from '../../engine/cds-engine.types';
import { toFhirReference } from '../../utils/fhir-reference';
import { resolveCoding, SEVERITY_TO_FHIR_PRIORITY } from './fhir-coding-defaults';

/**
 * Maps CDS care plan cards to writable FHIR R4 resources.
 *
 * Since FHIR CarePlan is NOT writable on major EHRs (Cerner, Epic),
 * we write via:
 * - DocumentReference (7 EHRs) — structured JSON of the full care plan
 * - Communication (6 EHRs) — one per critical/warning card for clinical inbox
 */

interface CarePlanContext {
  patientFhirId: string;
  encounterFhirId?: string | null;
  providerFhirId?: string | null;
  providerName?: string | null;
  title: string;
  status: string;
  version: number;
  ehrName: string;
  cards: CdsCard[];
  createdAt: Date | string;
}

@Injectable()
export class FhirMapperService {
  /**
   * Build a FHIR DocumentReference containing the full care plan as a structured JSON attachment.
   * LOINC 18776-5 = "Plan of care note"
   */
  buildDocumentReference(ctx: CarePlanContext): Record<string, unknown> {
    const cardsWithCoding = ctx.cards.map((card) => ({
      ...card,
      coding: resolveCoding(card),
    }));

    const jsonPayload = JSON.stringify({
      title: ctx.title,
      status: ctx.status,
      version: ctx.version,
      generatedAt: new Date(ctx.createdAt).toISOString(),
      cards: cardsWithCoding,
    });

    const resource: Record<string, unknown> = {
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [{ system: 'http://loinc.org', code: '18776-5', display: 'Plan of care note' }],
        text: 'CDS Care Plan',
      },
      category: [{ coding: [{ system: 'http://loinc.org', code: '11488-4', display: 'Consult note' }] }],
      subject: { reference: `Patient/${ctx.patientFhirId}` },
      date: new Date(ctx.createdAt).toISOString(),
      description: ctx.title,
      content: [
        {
          attachment: {
            contentType: 'application/json',
            data: Buffer.from(jsonPayload).toString('base64'),
            title: `${ctx.title} (v${ctx.version})`,
          },
        },
      ],
    };

    if (ctx.providerFhirId) {
      resource.author = [
        { reference: toFhirReference(ctx.providerFhirId, 'Practitioner'), display: ctx.providerName || undefined },
      ];
    }

    if (ctx.encounterFhirId) {
      resource.context = { encounter: [{ reference: `Encounter/${ctx.encounterFhirId}` }] };
    }

    return resource;
  }

  /**
   * Build FHIR Communication resources for critical/warning cards.
   * These appear in the clinical inbox/task workflow.
   */
  buildCommunications(ctx: CarePlanContext): { resource: Record<string, unknown>; cardIndex: number }[] {
    return ctx.cards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.severity === 'critical' || card.severity === 'warning')
      .map(({ card, index }) => ({
        resource: this.buildSingleCommunication(card, ctx),
        cardIndex: index,
      }));
  }

  private buildSingleCommunication(card: CdsCard, ctx: CarePlanContext): Record<string, unknown> {
    const coding = resolveCoding(card);
    const priority = SEVERITY_TO_FHIR_PRIORITY[card.severity as CdsSeverity] || 'routine';

    // Format card content as clinical text
    const lines = [`[${card.severity.toUpperCase()}] ${card.summary}`, '', card.detail];
    if (card.suggestions.length > 0) {
      lines.push('', 'Suggested Actions:');
      card.suggestions.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }
    const contentString = lines.join('\n');

    const resource: Record<string, unknown> = {
      resourceType: 'Communication',
      status: 'completed',
      priority,
      category: [
        {
          coding: [
            { system: 'http://terminology.hl7.org/CodeSystem/communication-category', code: 'alert', display: 'Alert' },
          ],
          text: card.category,
        },
      ],
      subject: { reference: `Patient/${ctx.patientFhirId}` },
      payload: [{ contentString }],
      reasonCode: [{ coding: [coding], text: coding.display }],
    };

    if (ctx.encounterFhirId) {
      resource.encounter = { reference: `Encounter/${ctx.encounterFhirId}` };
    }

    if (ctx.providerFhirId) {
      resource.sender = {
        reference: toFhirReference(ctx.providerFhirId, 'Practitioner'),
        display: ctx.providerName || undefined,
      };
    }

    return resource;
  }
}
