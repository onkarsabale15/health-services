import { AppError } from './app.error';

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, {
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'invalid',
          details: { text: message },
          diagnostics: details,
        },
      ],
    });
    this.name = 'ValidationError';
  }
}
