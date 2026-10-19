import { Injectable } from '@nestjs/common';
import { logger } from '@hs/observability';
import {
  TerminologyClient,
  URI_TO_SYSTEM,
  type TerminologyConceptWithMappings,
  type TerminologySystem,
} from './terminology.client';

// ─── FHIR Coding Enricher ────────────────────────────────────────────────────
//
// Generic safety net for FHIR writebacks. Given any FHIR resource that
// carries a `CodeableConcept` at `code.coding[]` (Condition, Observation,
// Procedure, DiagnosticReport, etc.), this service:
//
//   1. Scans existing codings for a recognized system (SNOMED, ICD-10, …)
//   2. Looks up each one via the bridge terminology API
//   3. Appends any cross-mapped coding that isn't already present
//
// Runs as a best-effort enrichment step before the FHIR write is forwarded
// to bridge. Idempotent: if both sides of a code pair are already supplied
// by the client, it's a no-op. Lookup failures are logged but never block
// the write — partial enrichment beats a failed clinical action.
//
// Extensibility: the enricher is agnostic to which systems are paired. Any
// (system, code) that `TerminologyClient.lookup` knows about will have its
// `mappings[]` merged in — so when bridge adds LOINC↔SNOMED or other cross-
// mappings in the future, this enricher picks them up automatically.

interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

@Injectable()
export class FhirCodingEnricher {
  constructor(private readonly terminology: TerminologyClient) {}

  /**
   * Return a new FHIR resource body with any missing cross-mapped codings
   * appended to `code.coding[]`. The original input is not mutated.
   *
   * @param body A FHIR resource with a `code.coding[]` field. Resources
   *             without that field are returned unchanged.
   */
  async enrichCodeableConcept(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const codeableConcept = body.code as FhirCodeableConcept | undefined;
    const codings = codeableConcept?.coding;
    if (!codings || codings.length === 0) return body;

    const existingUris = new Set(codings.filter((c) => c.system).map((c) => c.system!));

    const additions: FhirCoding[] = [];
    for (const coding of codings) {
      const mapped = await this.findCrossMappings(coding);
      for (const newCoding of mapped) {
        if (existingUris.has(newCoding.system!)) continue;
        additions.push(newCoding);
        existingUris.add(newCoding.system!);
      }
    }

    if (additions.length === 0) return body;

    logger.info('Enriched FHIR resource with cross-mapped codings', {
      addedSystems: additions.map((a) => a.system),
    });

    return {
      ...body,
      code: {
        ...codeableConcept,
        coding: [...codings, ...additions],
      },
    };
  }

  // ── Internal ───────────────────────────────────────────────────────────

  /**
   * Resolve a single coding to the set of cross-mapped codings we should
   * add. Returns an empty array for unknown systems, missing codes, or
   * lookup failures.
   */
  private async findCrossMappings(coding: FhirCoding): Promise<FhirCoding[]> {
    if (!coding.system || !coding.code) return [];

    const system = URI_TO_SYSTEM[coding.system];
    if (!system) return [];

    const concept = await this.safeLookup(system, coding.code);
    if (!concept) return [];

    return concept.mappings.map((m) => ({
      system: m.systemUri,
      code: m.code,
      display: m.display ?? undefined,
    }));
  }

  private async safeLookup(system: TerminologySystem, code: string): Promise<TerminologyConceptWithMappings | null> {
    try {
      return await this.terminology.lookup(system, code);
    } catch (error: unknown) {
      logger.warn('Terminology lookup failed during enrichment', {
        system,
        code,
        error: (error as Error)?.message,
      });
      return null;
    }
  }
}
