import specJson from '../../openapi.json';

/** Parsed OpenAPI 3.x document */
export type OpenApiSpec = typeof specJson;

/** OpenAPI operation parameter */
export interface SpecParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
}

/** OpenAPI operation summary */
export interface SpecOperation {
  method: string;
  path: string;
  summary?: string;
  operationId?: string;
  parameters: SpecParameter[];
  tags: string[];
}

const FHIR_PATH_PREFIX = '/api/fhir/r4/v1/';

/** Get the raw OpenAPI spec */
export function getBridgeSpec(): OpenApiSpec {
  return specJson;
}

/** Extract all FHIR resource types from the spec */
export function getFhirResourceTypes(): string[] {
  const types = new Set<string>();

  for (const path of Object.keys(specJson.paths)) {
    if (path.startsWith(FHIR_PATH_PREFIX)) {
      const rest = path.slice(FHIR_PATH_PREFIX.length);
      const resourceType = rest.split('/')[0];
      if (resourceType && resourceType !== 'metadata') {
        types.add(resourceType);
      }
    }
  }

  return Array.from(types).sort();
}

/** Get search parameters for a FHIR resource type */
export function getSearchParams(resourceType: string): SpecParameter[] {
  const path = `${FHIR_PATH_PREFIX}${resourceType}`;
  const pathItem = (specJson.paths as Record<string, any>)[path];
  if (!pathItem?.get?.parameters) return [];

  return pathItem.get.parameters
    .filter((p: any) => p.in === 'query')
    .map((p: any) => ({
      name: p.name,
      type: p.schema?.type || 'string',
      required: p.required || false,
      description: p.description,
      enum: p.schema?.enum,
    }));
}

/** Get available operations (search, read, create, update) for a FHIR resource */
export function getResourceOperations(resourceType: string): string[] {
  const ops: string[] = [];
  const paths = specJson.paths as Record<string, any>;

  const searchPath = `${FHIR_PATH_PREFIX}${resourceType}`;
  const readPath = `${FHIR_PATH_PREFIX}${resourceType}/{id}`;

  if (paths[searchPath]?.get) ops.push('search');
  if (paths[readPath]?.get) ops.push('read');
  if (paths[searchPath]?.post) ops.push('create');
  if (paths[readPath]?.put) ops.push('update');

  return ops;
}

/** Get all operations (FHIR + non-FHIR) from the spec */
export function getAllOperations(): SpecOperation[] {
  const operations: SpecOperation[] = [];
  const paths = specJson.paths as Record<string, any>;

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods as Record<string, any>)) {
      if (['get', 'post', 'put', 'delete', 'patch'].includes(method) && op && typeof op === 'object') {
        const params: SpecParameter[] = (op.parameters || [])
          .filter((p: any) => p.in === 'query')
          .map((p: any) => ({
            name: p.name,
            type: p.schema?.type || 'string',
            required: p.required || false,
            description: p.description,
            enum: p.schema?.enum,
          }));

        operations.push({
          method: method.toUpperCase(),
          path,
          summary: op.summary,
          operationId: op.operationId,
          parameters: params,
          tags: op.tags || [],
        });
      }
    }
  }

  return operations;
}
