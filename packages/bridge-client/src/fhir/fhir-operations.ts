/**
 * Dynamic FHIR operations registry — auto-derived from the Bridge API OpenAPI spec.
 *
 * When a new FHIR controller/method is added to bridge-api:
 *   1. bridge-api builds → OpenAPI spec regenerates
 *   2. bridge-sdk builds → this file reads the new spec
 *   3. workflow-ui picks up new operations automatically — no code changes needed
 *
 * Human-friendly labels and parameter types are inferred from the spec's
 * descriptions, enums, and naming conventions.
 */

import specJson from '../../openapi.json';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FhirParamDef {
  name: string;
  label: string;
  type: 'string' | 'enum' | 'date' | 'boolean' | 'number' | 'reference';
  required: boolean;
  description: string;
  placeholder?: string;
  enum?: string[];
  group: 'resource' | 'common';
}

export interface FhirOperationDef {
  id: string;
  operation: 'search' | 'read' | 'create' | 'update';
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  label: string;
  description: string;
  parameters: FhirParamDef[];
}

export interface FhirResourceDef {
  resourceType: string;
  label: string;
  operations: FhirOperationDef[];
}

// ─── EHR Vendors (static — vendor support is codebase-level, not API-level) ─

export const EHR_VENDORS = [
  { id: 'epic', label: 'Epic' },
  { id: 'cerner', label: 'Cerner' },
  { id: 'athenaNet', label: 'AthenaNet' },
  { id: 'eClinicalWorks', label: 'eClinicalWorks' },
  { id: 'nextgen', label: 'NextGen' },
  { id: 'elationEmr', label: 'Elation' },
  { id: 'drChrono', label: 'DrChrono' },
  { id: 'meditech', label: 'MEDITECH' },
] as const;

// ─── Spec parsing ───────────────────────────────────────────────────────────

const FHIR_PATH_PREFIX = '/api/fhir/r4/v1/';
const paths = specJson.paths as Record<string, any>;

/** Common base FHIR search params (underscore-prefixed) */
const COMMON_PARAM_NAMES = new Set([
  '_id',
  '_count',
  '_offset',
  '_sort',
  '_include',
  '_revinclude',
  '_elements',
  '_summary',
  '_total',
]);

/** Infer if a param is a date type from its name or description */
function isDateParam(name: string, description?: string): boolean {
  const dateParts = ['date', 'birthdate', 'onset-date', 'abatement-date', 'authored', 'period', 'effective'];
  const lowerName = name.toLowerCase();
  if (dateParts.some((d) => lowerName === d || lowerName.endsWith('-date'))) return true;
  if (description && /date|period|YYYY/i.test(description)) return true;
  return false;
}

/** Infer if a param is a reference from name or description */
function isReferenceParam(name: string, description?: string): boolean {
  const refParts = [
    'patient',
    'subject',
    'encounter',
    'practitioner',
    'performer',
    'requester',
    'owner',
    'sender',
    'recipient',
    'author',
    'recorder',
    'general-practitioner',
    'organization',
    'location',
    'service-provider',
    'participant',
    'subscriber',
    'beneficiary',
    'payor',
  ];
  if (refParts.includes(name.toLowerCase())) return true;
  if (description && /reference/i.test(description)) return true;
  return false;
}

/** Convert kebab-case or underscore param name to human-friendly label */
function toLabel(name: string): string {
  // Remove leading underscore for common params
  const clean = name.startsWith('_') ? name.slice(1) : name;
  return clean
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Convert PascalCase resourceType to spaced label (e.g., AllergyIntolerance → Allergy Intolerance) */
function resourceLabel(rt: string): string {
  return rt.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** Parse a single OpenAPI parameter into a FhirParamDef */
function parseParam(p: any): FhirParamDef {
  const name: string = p.name;
  const description: string = p.description || '';
  const schema = p.schema || {};
  const enumValues: string[] | undefined = schema.enum;
  const isCommon = COMMON_PARAM_NAMES.has(name);

  let type: FhirParamDef['type'] = 'string';
  if (enumValues && enumValues.length > 0) {
    type = 'enum';
  } else if (isDateParam(name, description)) {
    type = 'date';
  } else if (isReferenceParam(name, description)) {
    type = 'reference';
  } else if (schema.type === 'number' || schema.type === 'integer' || name === '_count' || name === '_offset') {
    type = 'number';
  } else if (schema.type === 'boolean' || name === 'active') {
    type = 'boolean';
  }

  return {
    name,
    label: toLabel(name),
    type,
    required: p.required || false,
    description,
    placeholder: p.example || (type === 'date' ? 'YYYY-MM-DD' : undefined),
    ...(enumValues ? { enum: enumValues } : {}),
    group: isCommon ? 'common' : 'resource',
  };
}

/** Build FhirOperationDef[] for a resource by scanning the spec paths */
function buildOps(resourceType: string): FhirOperationDef[] {
  const ops: FhirOperationDef[] = [];
  const basePath = `${FHIR_PATH_PREFIX}${resourceType}`;
  const idPath = `${FHIR_PATH_PREFIX}${resourceType}/{id}`;
  const rtLower = resourceType.charAt(0).toLowerCase() + resourceType.slice(1);
  const label = resourceLabel(resourceType);

  // Search (GET /ResourceType)
  const baseItem = paths[basePath];
  if (baseItem?.get) {
    const params: FhirParamDef[] = (baseItem.get.parameters || []).filter((p: any) => p.in === 'query').map(parseParam);

    ops.push({
      id: `search-${rtLower}`,
      operation: 'search',
      method: 'GET',
      path: basePath,
      label: `Search ${label}`,
      description: baseItem.get.summary || `Search ${label} resources`,
      parameters: params,
    });
  }

  // Read (GET /ResourceType/{id})
  const idItem = paths[idPath];
  if (idItem?.get) {
    ops.push({
      id: `read-${rtLower}`,
      operation: 'read',
      method: 'GET',
      path: idPath,
      label: `Read ${label}`,
      description: idItem.get.summary || `Read a ${label} by ID`,
      parameters: [
        {
          name: 'id',
          label: 'Resource ID',
          type: 'string',
          required: true,
          description: `The logical ID of the ${label}`,
          placeholder: '12345',
          group: 'resource',
        },
      ],
    });
  }

  // Create (POST /ResourceType)
  if (baseItem?.post) {
    ops.push({
      id: `create-${rtLower}`,
      operation: 'create',
      method: 'POST',
      path: basePath,
      label: `Create ${label}`,
      description: baseItem.post.summary || `Create a new ${label}`,
      parameters: [
        {
          name: 'body',
          label: 'Resource Body',
          type: 'string',
          required: true,
          description: `FHIR R4 ${label} JSON`,
          placeholder: `{ "resourceType": "${resourceType}", ... }`,
          group: 'resource',
        },
      ],
    });
  }

  // Update (PUT /ResourceType/{id})
  if (idItem?.put) {
    ops.push({
      id: `update-${rtLower}`,
      operation: 'update',
      method: 'PUT',
      path: idPath,
      label: `Update ${label}`,
      description: idItem.put.summary || `Update a ${label}`,
      parameters: [
        {
          name: 'id',
          label: 'Resource ID',
          type: 'string',
          required: true,
          description: `The logical ID of the ${label} to update`,
          placeholder: '12345',
          group: 'resource',
        },
        {
          name: 'body',
          label: 'Resource Body',
          type: 'string',
          required: true,
          description: `FHIR R4 ${label} JSON (full replacement)`,
          placeholder: `{ "resourceType": "${resourceType}", ... }`,
          group: 'resource',
        },
      ],
    });
  }

  return ops;
}

// ─── Build the registry from the spec ───────────────────────────────────────

function buildRegistry(): FhirResourceDef[] {
  const resourceTypes = new Set<string>();

  for (const path of Object.keys(paths)) {
    if (path.startsWith(FHIR_PATH_PREFIX)) {
      const rest = path.slice(FHIR_PATH_PREFIX.length);
      const rt = rest.split('/')[0];
      if (rt && rt !== 'metadata' && rt !== '{id}') {
        resourceTypes.add(rt);
      }
    }
  }

  return Array.from(resourceTypes)
    .sort()
    .map((rt) => ({
      resourceType: rt,
      label: resourceLabel(rt),
      operations: buildOps(rt),
    }))
    .filter((r) => r.operations.length > 0);
}

/** All FHIR resources and their operations — auto-derived from the OpenAPI spec */
export const FHIR_RESOURCES: FhirResourceDef[] = buildRegistry();

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Get a resource definition by type (e.g., "Patient") */
export function getFhirResource(resourceType: string): FhirResourceDef | undefined {
  return FHIR_RESOURCES.find((r) => r.resourceType === resourceType);
}

/** Get an operation by its ID (e.g., "search-patient") */
export function getFhirOperation(
  operationId: string,
): { resource: FhirResourceDef; operation: FhirOperationDef } | undefined {
  for (const res of FHIR_RESOURCES) {
    const op = res.operations.find((o) => o.id === operationId);
    if (op) return { resource: res, operation: op };
  }
  return undefined;
}

/** Flat list of all FHIR operations across all resources */
export function getAllFhirOperations(): FhirOperationDef[] {
  return FHIR_RESOURCES.flatMap((r) => r.operations);
}
