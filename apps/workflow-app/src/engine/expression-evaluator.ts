import jsonata from 'jsonata';

/**
 * Evaluate a JSONata expression against a context object.
 * JSONata is safe — no code execution, no filesystem access, no eval.
 */
export async function evaluateExpression(expression: string, context: Record<string, any>): Promise<any> {
  const expr = jsonata(expression);
  return expr.evaluate(context);
}

/**
 * Resolve template strings containing {{expressions}}.
 * Replaces each {{...}} with the evaluated JSONata result.
 *
 * Example: "Patient/{{$nodes.trigger.output.patientId}}"
 * Becomes: "Patient/12345"
 */
export async function resolveTemplate(template: string, context: Record<string, any>): Promise<string> {
  const pattern = /\{\{(.+?)\}\}/g;
  let result = template;
  const matches = [...template.matchAll(pattern)];

  for (const match of matches) {
    const expr = match[1].trim();
    const value = await evaluateExpression(expr, context);
    result = result.replace(match[0], value != null ? String(value) : '');
  }

  return result;
}

/**
 * Resolve all string values in a params object that may contain {{expressions}}.
 */
export async function resolveParams(
  params: Record<string, string>,
  context: Record<string, any>,
): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    resolved[key] = await resolveTemplate(value, context);
  }
  return resolved;
}
