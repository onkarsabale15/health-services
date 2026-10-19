import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StructuredTool } from '@langchain/core/tools';
import { CdsRule, CdsCard } from '../cds-engine.types';
import { SYSTEM_PROMPT } from '../prompts/system';
import { parseCards } from '../output/cds-card-parser';
import { mergeCards } from '../output/card-merger';

const MAX_ITERATIONS = 10;

function buildRulesContext(rules: CdsRule[]): string {
  if (rules.length === 0) return 'No specific rules configured. Perform a general clinical review.';

  return rules
    .map((r, i) => {
      const resources = r.fhirResources.length > 0 ? `Resources: ${r.fhirResources.join(', ')}` : '';
      const prompt = r.promptTemplate ? `\nInstructions: ${r.promptTemplate}` : '';
      return `${i + 1}. [${r.name}] (${r.hook}) ${resources}${prompt}`;
    })
    .join('\n');
}

export async function runClinicalAnalysis(config: {
  model: BaseChatModel;
  tools: StructuredTool[];
  rules: CdsRule[];
  patientId: string;
  encounterId?: string;
  verbose?: boolean;
}): Promise<CdsCard[]> {
  const { model, tools, rules, patientId, encounterId } = config;

  const rulesContext = buildRulesContext(rules);
  const encounterLine = encounterId ? `Encounter ID: ${encounterId}` : '';

  const app = createReactAgent({
    llm: model,
    tools,
    prompt: SYSTEM_PROMPT,
  });

  const humanContent = `Analyze the following patient and generate CDS recommendation cards.

Patient ID: ${patientId}
${encounterLine}

Active CDS Rules:
${rulesContext}

Use the available FHIR tools to fetch the required patient data, then return your recommendations as a JSON array of CDS cards.
Always scope FHIR searches to this patient (use patient=${patientId} parameter).`;

  const result = await app.invoke(
    { messages: [new HumanMessage(humanContent)] },
    { recursionLimit: MAX_ITERATIONS * 2 + 1 },
  );

  const lastMessage = result.messages[result.messages.length - 1];
  const rawOutput = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
  const cards = parseCards(rawOutput);

  return mergeCards(cards);
}
