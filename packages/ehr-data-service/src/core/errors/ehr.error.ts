import { AppError } from './app.error';

export class EhrError extends AppError {
  ehrName: string;

  constructor(statusCode: number, message: string, ehrName: string, body?: any) {
    super(statusCode, message, body);
    this.name = 'EhrError';
    this.ehrName = ehrName;
  }
}
