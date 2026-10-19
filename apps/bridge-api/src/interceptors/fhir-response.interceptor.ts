import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

const FHIR_CONTENT_TYPE = 'application/fhir+json; charset=utf-8';

/**
 * FHIR R4 response interceptor:
 * 1. Unwraps internal { statusCode/status, data, headers } → proper HTTP status + FHIR body
 * 2. Sets Content-Type to application/fhir+json for FHIR endpoints
 */
@Injectable()
export class FhirResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const isFhirEndpoint = request.url?.includes('/fhir/');

    return next.handle().pipe(
      map((result) => {
        if (!result || typeof result !== 'object') return result;

        const res = context.switchToHttp().getResponse();

        // Set FHIR Content-Type for FHIR endpoints
        if (isFhirEndpoint) {
          res.setHeader('Content-Type', FHIR_CONTENT_TYPE);
        }

        const httpStatus = result.statusCode || result.status;

        // Unwrap if it looks like a FhirResponseDto: has a numeric status + data field
        if (typeof httpStatus === 'number' && 'data' in result) {
          res.status(httpStatus);

          // Forward response headers (e.g. Location for 201 Created)
          if (result.headers && typeof result.headers === 'object') {
            for (const [key, value] of Object.entries(result.headers)) {
              if (typeof value === 'string') {
                res.setHeader(key, value);
              }
            }
          }

          // Return the FHIR resource directly (no wrapper)
          return result.data === '' || result.data === undefined ? undefined : result.data;
        }

        return result;
      }),
    );
  }
}
