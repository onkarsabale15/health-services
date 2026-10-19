export class AppError extends Error {
  statusCode: number;
  body: any;

  constructor(statusCode: number, message: string, body?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.body = body || { message };
  }
}
