import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { logger } from '@hs/observability';
import { cache } from '@hs/infra';
import { db } from '@hs/infra';
import { type CdsRule, type CdsCard, CdsCardArraySchema } from '../../engine';
import { createLlmProvider, resolveApiKey, type ILlmProvider, type LlmProviderType } from '@hs/ai';
import { secrets } from '@hs/infra';
import { SessionService, type CdsSession } from '../../services/session.service';
import { ClinicalDataService } from '../clinical-data/clinical-data.service';
import type {
  AllergySummary,
  ConditionSummary,
  EncounterSummary,
  MedicationSummary,
  PatientSummary,
  VitalSummary,
} from '../clinical-data/fhir-mappers';
import { CarePlanService } from '../care-plan/care-plan.service';

const RULES_CACHE_TTL = 600;

interface AnalysisOptions {
  previousCarePlanId?: string;
  instructions?: string;
}

@Injectable()
export class AnalysisService {
  constructor(
    private readonly config: ConfigService,
    private readonly sessionService: SessionService,
    private readonly clinicalDataService: ClinicalDataService,
    private readonly carePlanService: CarePlanService,
  ) {}

  /**
   * Single-call analysis: pre-fetched clinical data → one LLM call → parse cards.
   * Supports re-analysis: includes previous care plan + provider comment in prompt.
   */
  async runAsync(providerSessionId: string, options: AnalysisOptions = {}): Promise<void> {
    const startMs = Date.now();

    try {
      const session = await this.sessionService.getFullSession(providerSessionId);
      if (!session || !session.patientContext) {
        logger.error('CDS analysis: session or patient context not found', new Error('Session not found'), {
          providerSessionId,
        });
        await this.sessionService
          .updateStatus(providerSessionId, 'error', 'Session expired — re-launch from EHR')
          .catch(() => {});
        return;
      }

      await this.sessionService.updateStatus(providerSessionId, 'analyzing');

      // 1. Load CDS rules
      const rules = await this.loadRules(session.providerSession.applicationId);
      if (rules.length === 0) {
        logger.warn('CDS analysis: no active rules, using default clinical prompts', {
          applicationId: session.providerSession.applicationId,
        });
      }

      // 2. Fetch clinical data (likely cached from UI calls). Encounter is
      // fetched by id from the session's patient context — no separate
      // "active encounter" lookup needed.
      const encounterId = session.patientContext?.encounterId;
      const [patient, encounter, conditions, allergies, medications, vitals] = await Promise.allSettled([
        this.clinicalDataService.getPatient(session),
        encounterId ? this.clinicalDataService.getEncounterById(session, encounterId) : Promise.resolve({ data: null }),
        this.clinicalDataService.getConditions(session),
        this.clinicalDataService.getAllergies(session),
        this.clinicalDataService.getMedications(session),
        this.clinicalDataService.getVitals(session),
      ]);

      const clinicalContext = {
        patient: patient.status === 'fulfilled' ? patient.value.data : null,
        encounter: encounter.status === 'fulfilled' ? encounter.value.data : null,
        conditions: conditions.status === 'fulfilled' ? conditions.value.data : [],
        allergies: allergies.status === 'fulfilled' ? allergies.value.data : [],
        medications: medications.status === 'fulfilled' ? medications.value.data : [],
        vitals: vitals.status === 'fulfilled' ? vitals.value.data : [],
      };

      // 3. Load previous care plan if re-analyzing
      let previousCards: CdsCard[] | null = null;
      if (options.previousCarePlanId) {
        const prev = await db.getClient().carePlan.findUnique({
          where: { id: options.previousCarePlanId },
          select: { cards: true, version: true },
        });
        if (prev) {
          previousCards = prev.cards as CdsCard[];
          logger.info('CDS re-analysis: loaded previous care plan', {
            providerSessionId,
            previousCarePlanId: options.previousCarePlanId,
            previousVersion: prev.version,
            previousCardCount: previousCards.length,
          });
        }
      }

      // 4. Create LLM provider via @hs/ai factory
      const appConfig = await this.loadAppConfig(session.providerSession.applicationId);
      const defaultProvider = this.config.get<string>('app.defaultLlmProvider')! as LlmProviderType;
      const defaultModel = this.config.get<string>('app.defaultLlmModel')!;
      const provider = (appConfig?.modelProvider as LlmProviderType) || defaultProvider;
      const modelName = appConfig?.modelName || defaultModel;
      const apiKey = await resolveApiKey(session.providerSession.applicationId, provider, secrets);

      const llm = createLlmProvider({
        provider,
        model: modelName,
        apiKey,
        temperature: 0.2,
        maxTokens: 16384,
        responseFormat: 'json',
      });

      // 5. Single LLM call with context-aware prompt
      const isReanalysis = !!previousCards;
      logger.info('CDS analysis: calling LLM', {
        providerSessionId,
        provider,
        model: modelName,
        rulesCount: rules.length,
        isReanalysis,
        hasInstructions: !!options.instructions,
      });

      const prompt = buildAnalysisPrompt(clinicalContext, rules, previousCards, options.instructions);
      const content = await callLlmWithRetry(llm, prompt, 3);

      // 6. Parse cards
      const cards = parseCardsFromResponse(content);

      // 7. Store results in Redis (for polling)
      await this.sessionService.storeResults(providerSessionId, cards);
      await this.sessionService.updateStatus(providerSessionId, 'complete');

      // 8. Auto-save as DRAFT care plan, linked to parent if re-analysis
      if (cards.length > 0) {
        await this.autoSaveCarePlan(session, cards, options, { provider, modelName });
      }

      const durationMs = Date.now() - startMs;
      logger.info('CDS analysis complete', {
        providerSessionId,
        cardsGenerated: cards.length,
        durationMs,
        isReanalysis,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('CDS analysis error', error instanceof Error ? error : new Error(errorMessage), {
        providerSessionId,
      });
      await this.sessionService.updateStatus(providerSessionId, 'error', errorMessage);
    }
  }

  private async loadRules(applicationId: string): Promise<CdsRule[]> {
    const cacheKey = `cds:rules:${applicationId}`;
    const cached = await cache.get<CdsRule[]>(cacheKey);
    if (cached) return cached;

    const prismaRules = await db.getClient().cdsRule.findMany({
      where: { applicationId, isActive: true },
    });

    const rules: CdsRule[] = prismaRules.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description || undefined,
      hook: r.hook,
      fhirResources: r.fhirResources,
      promptTemplate: r.promptTemplate || undefined,
      modelProvider: r.modelProvider,
      modelName: r.modelName,
      isActive: r.isActive,
    }));

    await cache.set(cacheKey, rules, RULES_CACHE_TTL);
    return rules;
  }

  private async autoSaveCarePlan(
    session: CdsSession,
    cards: CdsCard[],
    options: AnalysisOptions,
    llm: { provider: string; modelName: string },
  ): Promise<void> {
    try {
      const pc = session.patientContext;
      if (!pc) return;

      await this.carePlanService.create(session.providerSession, pc, {
        title: CarePlanService.generateTitle(cards),
        cards,
        status: 'DRAFT',
        parentId: options.previousCarePlanId,
        generatedBy: `ai:${llm.provider}:${llm.modelName}`,
      });
    } catch (err: unknown) {
      logger.error('Failed to auto-save care plan', err instanceof Error ? err : new Error(String(err)));
    }
  }

  private async loadAppConfig(applicationId: string): Promise<{ modelProvider?: string; modelName?: string } | null> {
    const app = await db.getClient().application.findUnique({
      where: { id: applicationId },
      select: { cdsConfig: true },
    });
    if (!app?.cdsConfig || typeof app.cdsConfig !== 'object') return null;
    const config = app.cdsConfig as Record<string, unknown>;
    return {
      modelProvider: typeof config.modelProvider === 'string' ? config.modelProvider : undefined,
      modelName: typeof config.modelName === 'string' ? config.modelName : undefined,
    };
  }
}

// ── LLM Call with Retry ─────────────────────────────────────

async function callLlmWithRetry(llm: ILlmProvider, prompt: string, maxRetries: number): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await llm.chat([
        { role: 'system', content: 'You are a clinical decision support AI. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ]);
      return response.content;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const retryMatch = message.match(/retry in ([\d.]+)s/i);
      const isRateLimit = message.includes('429') || message.includes('Too Many Requests') || message.includes('rate');

      if (isRateLimit && attempt < maxRetries) {
        const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 1 : 10;
        logger.warn('LLM rate limited, retrying', { attempt, waitSec, maxRetries });
        await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('LLM call failed after max retries');
}

// ── Prompt Builder ──────────────────────────────────────────

interface ClinicalContext {
  patient: PatientSummary | null;
  encounter: EncounterSummary | null;
  conditions: ConditionSummary[];
  allergies: AllergySummary[];
  medications: MedicationSummary[];
  vitals: VitalSummary[];
}

function buildAnalysisPrompt(
  clinical: ClinicalContext,
  rules: CdsRule[],
  previousCards: CdsCard[] | null,
  instructions?: string,
): string {
  const rulesSection =
    rules.length > 0
      ? `\n## Active CDS Rules\n${rules.map((r) => `- **${r.name}** (${r.hook}): ${r.description || r.promptTemplate || 'No specific instructions'}`).join('\n')}`
      : '';

  // Provider instructions — works for both fresh and re-analysis
  let instructionsSection = '';
  if (instructions) {
    instructionsSection = `

## Provider Instructions — HIGHEST PRIORITY
The treating provider has provided the following instructions for this analysis. These MUST take precedence over all algorithmic recommendations — the provider has direct clinical context not captured in the structured data:

"${instructions}"

You MUST:
1. Directly address every point the provider raised
2. If the provider says something is irrelevant — do NOT generate a card for it
3. If the provider asks to focus on a specific area — ADD cards for it
4. If the provider provides clinical context (e.g., "patient tolerates metformin well") — use that to override generic alerts
5. Explain in the card detail how the provider's instructions influenced the recommendation`;
  }

  // Previous analysis for re-analysis
  let previousSection = '';
  if (previousCards) {
    previousSection = `

## Previous Analysis (${previousCards.length} recommendations)
The provider is requesting a re-analysis. Below is the previous analysis output. Use it as context — do NOT simply repeat it.

${previousCards.map((c, i) => `${i + 1}. [${c.severity.toUpperCase()}] ${c.category}: ${c.summary}\n   Detail: ${c.detail}\n   Suggestions: ${c.suggestions.join('; ')}`).join('\n\n')}

## Re-analysis Guidelines
${instructions ? '- Provider instructions above take precedence over previous recommendations' : '- Re-evaluate all recommendations with fresh clinical data'}
- Keep valid recommendations from the previous analysis${instructions ? ' that the provider did not question' : ''}
- Remove recommendations that are no longer clinically relevant
- Add new recommendations if clinical data${instructions ? ', provider instructions,' : ''} or guidelines reveal gaps
- Do NOT simply repeat the previous analysis — provide updated, refined recommendations`;
  }

  return `You are a clinical decision support AI assistant. Analyze the following patient data and generate actionable clinical recommendations.

## Patient
${clinical.patient ? `Age: ${clinical.patient.age}, Gender: ${clinical.patient.gender}` : 'No patient data available'}

## Current Encounter
${clinical.encounter ? `Type: ${clinical.encounter.type}, Status: ${clinical.encounter.status}, Reason: ${clinical.encounter.reasonForVisit || 'N/A'}` : 'No encounter data'}

## Active Conditions (${clinical.conditions.length})
${clinical.conditions.length > 0 ? clinical.conditions.map((c) => `- ${c.name} (${c.icdCode || 'no code'}) — ${c.clinicalStatus}, onset: ${c.onsetDate || 'unknown'}`).join('\n') : 'None'}

## Allergies (${clinical.allergies.length})
${clinical.allergies.length > 0 ? clinical.allergies.map((a) => `- ${a.substance} — criticality: ${a.criticality}${a.reactions.length > 0 ? `, reactions: ${a.reactions.map((r) => r.manifestation).join(', ')}` : ''}`).join('\n') : 'None'}

## Active Medications (${clinical.medications.length})
${clinical.medications.length > 0 ? clinical.medications.map((m) => `- ${m.name} ${m.dosage || ''} ${m.route || ''} ${m.frequency || ''}`).join('\n') : 'None'}

## Recent Vitals (${clinical.vitals.length})
${clinical.vitals.length > 0 ? clinical.vitals.map((v) => `- ${v.name}: ${v.value} ${v.unit}${v.isAbnormal ? ' ⚠️ ABNORMAL' : ''}`).join('\n') : 'None'}
${rulesSection}${instructionsSection}${previousSection}

## Output Requirements
Based on the above clinical data${instructions ? ', provider instructions,' : ''} ${previousCards ? 'and previous analysis' : ''}, generate CDS recommendations. Focus on:
${instructions ? '1. **Provider instructions (highest priority)** — address every point\n' : ''}${instructions ? '2' : '1'}. Drug interactions between active medications and allergies
${instructions ? '3' : '2'}. Missing preventive screenings (USPSTF guidelines)
${instructions ? '4' : '3'}. Care gaps based on active conditions
${instructions ? '5' : '4'}. Patient safety concerns (abnormal vitals, high-risk allergies)
${instructions ? '6' : '5'}. Primary care suggestions

Return a JSON array of CDS cards (maximum 10 cards, prioritize by severity). Each card must have:
- "category": one of "pcp-suggestion", "allergy-caution", "drug-interaction", "missing-screening", "care-gap", "patient-safety"
- "severity": one of "critical", "warning", "info"
- "summary": brief one-line summary (max 140 chars)
- "detail": concise explanation (max 2-3 sentences)
- "suggestions": array of 1-3 actionable suggestions (keep each under 100 chars)
- "coding": (strongly preferred) FHIR R4 coding object for EHR interoperability: { "system": "<terminology URI>", "code": "<code>", "display": "<display>" }

## FHIR Coding Reference (use the most specific code that applies):
| Category | Default System | Example Code | Example Display |
|----------|---------------|--------------|-----------------|
| drug-interaction | http://snomed.info/sct | 419511003 | Propensity to adverse reactions to drug |
| allergy-caution | http://snomed.info/sct | 420134006 | Propensity to adverse reactions to substance |
| missing-screening | http://snomed.info/sct | 310634005 | Screening procedure required |
| care-gap | http://snomed.info/sct | 423827005 | Care plan gap identified |
| patient-safety | http://snomed.info/sct | 281694009 | Finding of at-risk patient |
| pcp-suggestion | http://snomed.info/sct | 306206005 | Referral to service |

Use http://snomed.info/sct for clinical findings and http://loinc.org for observations/screenings. Provide the most specific code possible — the defaults above are fallbacks.

IMPORTANT: Keep responses compact. Return ONLY the JSON array.`;
}

// ── Response Parser ─────────────────────────────────────────

function parseCardsFromResponse(content: string): CdsCard[] {
  try {
    let jsonStr = content.trim();

    // Strip markdown code fences
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

    // Extract the JSON array portion
    const arrayStart = jsonStr.indexOf('[');
    const arrayEnd = jsonStr.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd !== -1) {
      jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1);
    }

    // Try direct parse
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Repair and retry
      try {
        parsed = JSON.parse(repairJson(jsonStr));
      } catch {
        // Truncated response — extract complete card objects individually
        logger.warn('JSON parse failed, extracting individual cards');
        parsed = extractCompleteCards(jsonStr);
      }
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      logger.warn('No cards parsed from LLM response');
      return [];
    }

    const validated = CdsCardArraySchema.safeParse(parsed);
    if (validated.success) return validated.data;

    // Validate individually — keep valid cards, skip broken ones
    const validCards: CdsCard[] = [];
    for (const card of parsed) {
      const result = CdsCardArraySchema.element.safeParse(card);
      if (result.success) validCards.push(result.data);
    }
    logger.warn('CDS cards partial validation', { total: parsed.length, valid: validCards.length });
    return validCards;
  } catch (err) {
    logger.error('Failed to parse CDS cards from LLM response', err instanceof Error ? err : new Error(String(err)));
    return [];
  }
}

/** Extract complete JSON objects from a possibly truncated array string */
function extractCompleteCards(str: string): unknown[] {
  const cards: unknown[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      i++;
      while (i < str.length && str[i] !== '"') {
        if (str[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const block = str.slice(start, i + 1);
        try {
          cards.push(JSON.parse(block));
        } catch {
          try {
            cards.push(JSON.parse(repairJson(block)));
          } catch {
            /* skip malformed card */
          }
        }
        start = -1;
      }
    }
  }
  return cards;
}

/**
 * Fix common JSON issues from LLM outputs.
 * Walks the string char by char to properly escape control chars inside string values.
 */
function repairJson(str: string): string {
  const chars = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escaped) {
      chars.push(ch);
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      chars.push(ch);
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      chars.push(ch);
      continue;
    }

    // Inside a string: escape control characters
    if (inString) {
      if (ch === '\n') {
        chars.push('\\n');
        continue;
      }
      if (ch === '\r') {
        chars.push('\\r');
        continue;
      }
      if (ch === '\t') {
        chars.push('\\t');
        continue;
      }
    }

    chars.push(ch);
  }

  let fixed = chars.join('');
  // Remove trailing commas
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  // Close unclosed structures
  if (fixed.includes('[') && !fixed.includes(']')) fixed += ']';
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';
  return fixed;
}
