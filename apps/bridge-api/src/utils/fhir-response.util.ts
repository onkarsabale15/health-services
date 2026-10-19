import type { OperationOutcome, OperationOutcomeIssue } from '@medplum/fhirtypes';

type IssueSeverity = OperationOutcomeIssue['severity'];
type IssueCode = OperationOutcomeIssue['code'];

const SEVERITY_MAP: Record<number, IssueSeverity> = {
  400: 'error',
  401: 'error',
  403: 'error',
  404: 'warning',
  409: 'error',
  422: 'error',
  500: 'fatal',
  502: 'error',
  503: 'error',
};

const CODE_MAP: Record<number, IssueCode> = {
  400: 'invalid',
  401: 'login',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  422: 'processing',
  500: 'exception',
  502: 'exception',
  503: 'transient',
};

export function createOperationOutcome(statusCode: number, message: string, diagnostics?: string): OperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: SEVERITY_MAP[statusCode] || 'error',
        code: CODE_MAP[statusCode] || 'processing',
        details: { text: message },
        ...(diagnostics ? { diagnostics } : {}),
      },
    ],
  };
}
