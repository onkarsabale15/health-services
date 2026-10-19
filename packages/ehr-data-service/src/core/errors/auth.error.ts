import { AppError } from './app.error';

export class AuthError extends AppError {
  constructor(message: string) {
    super(401, message);
    this.name = 'AuthError';
  }
}
