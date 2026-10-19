import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { AppError } from '@hs/ehr-data-service';
import { logger } from '@hs/observability';

const FHIR_CONTENT_TYPE = 'application/fhir+json; charset=utf-8';

// FHIR R4 issue severity: http://hl7.org/fhir/issue-severity
const SEVERITY_MAP: Record<number, 'fatal' | 'error' | 'warning' | 'information'> = {
  400: 'error',
  401: 'error',
  403: 'error',
  404: 'warning',
  409: 'error',
  422: 'error',
  429: 'warning',
  500: 'fatal',
  502: 'error',
  503: 'error',
  504: 'error',
};

// FHIR R4 issue-type ValueSet: http://hl7.org/fhir/issue-type
const CODE_MAP: Record<number, string> = {
  400: 'invalid',
  401: 'login',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  422: 'processing',
  429: 'throttled',
  500: 'exception',
  502: 'exception',
  503: 'transient',
  504: 'timeout',
};

function toOperationOutcome(statusCode: number, message: string, diagnostics?: any) {
  const issue: any = {
    severity: SEVERITY_MAP[statusCode] || 'error',
    code: CODE_MAP[statusCode] || 'processing',
    details: { text: message },
  };

  if (diagnostics !== undefined && diagnostics !== null) {
    issue.diagnostics = typeof diagnostics === 'string' ? diagnostics : JSON.stringify(diagnostics);
  }

  return {
    resourceType: 'OperationOutcome',
    issue: [issue],
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let statusCode = 500;
    let body: any;

    if (exception instanceof AppError) {
      const appError = exception as AppError;
      statusCode = appError.statusCode;
      // If body is already an OperationOutcome, use it directly
      if (appError.body?.resourceType === 'OperationOutcome') {
        body = appError.body;
      } else {
        body = toOperationOutcome(statusCode, appError.message, appError.body);
      }
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exResponse = exception.getResponse();
      const message =
        typeof exResponse === 'string'
          ? exResponse
          : (exResponse as any)?.message || (exResponse as any)?.error_description || exception.message;
      body = toOperationOutcome(statusCode, Array.isArray(message) ? message.join('; ') : message);
    } else if (exception instanceof Error) {
      body = toOperationOutcome(500, exception.message);
    } else {
      body = toOperationOutcome(500, 'Internal server error');
    }

    logger.error('Unhandled exception', exception as Error, {
      path: request.url,
      method: request.method,
      statusCode,
    });

    // FHIR R4 Content-Type for all error responses
    response.status(statusCode).setHeader('Content-Type', FHIR_CONTENT_TYPE).json(body);
  }
}
