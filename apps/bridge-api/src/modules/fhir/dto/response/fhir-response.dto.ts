import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── FHIR Bundle ──────────────────────────────────────────────────────────────

export class FhirBundleLink {
  @ApiProperty({ example: 'self' })
  relation!: string;

  @ApiProperty({ example: 'https://fhir.example.com/Patient?_count=10' })
  url!: string;
}

export class FhirBundleEntrySearch {
  @ApiPropertyOptional({ enum: ['match', 'include', 'outcome'], example: 'match' })
  mode?: string;
}

export class FhirBundleEntry {
  @ApiPropertyOptional({ example: 'https://fhir.example.com/Patient/123' })
  fullUrl?: string;

  @ApiProperty({ description: 'FHIR resource' })
  resource!: Record<string, any>;

  @ApiPropertyOptional({ description: 'Search result metadata', type: FhirBundleEntrySearch })
  search?: FhirBundleEntrySearch;
}

export class FhirBundleResponse {
  @ApiProperty({ example: 'Bundle' })
  resourceType!: string;

  @ApiPropertyOptional({ example: 'searchset', enum: ['searchset', 'batch-response', 'transaction-response'] })
  type?: string;

  @ApiPropertyOptional({ example: 42 })
  total?: number;

  @ApiPropertyOptional({ type: [FhirBundleLink] })
  link?: FhirBundleLink[];

  @ApiPropertyOptional({ type: [FhirBundleEntry] })
  entry?: FhirBundleEntry[];
}

// ── FHIR Single Resource ─────────────────────────────────────────────────────

export class FhirResourceResponse {
  @ApiProperty({ description: 'FHIR resource type', example: 'Patient' })
  resourceType!: string;

  @ApiPropertyOptional({ description: 'Resource ID', example: '12345' })
  id?: string;

  @ApiPropertyOptional({ description: 'Resource metadata' })
  meta?: Record<string, any>;
}

// ── OperationOutcome (error) ─────────────────────────────────────────────────

export class OperationOutcomeIssue {
  @ApiProperty({ enum: ['fatal', 'error', 'warning', 'information'], example: 'error' })
  severity!: string;

  @ApiProperty({ example: 'invalid' })
  code!: string;

  @ApiPropertyOptional({ type: 'object', properties: { text: { type: 'string' } } })
  details?: { text: string };

  @ApiPropertyOptional({ example: 'Patient not found' })
  diagnostics?: string;
}

export class OperationOutcomeResponse {
  @ApiProperty({ example: 'OperationOutcome' })
  resourceType!: string;

  @ApiProperty({ type: [OperationOutcomeIssue] })
  issue!: OperationOutcomeIssue[];
}
