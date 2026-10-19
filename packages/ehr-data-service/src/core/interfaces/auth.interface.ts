export interface AuthContext {
  organizationId: string;
  networkId: string;
  organizationType: string;
  role: string;
  email: string;
  userId: string;
  expiresAt: string;
}

export interface IAuthProvider {
  validateToken(token: string): Promise<AuthContext>;
}

export interface IApiKeyValidator {
  validate(apiKey: string): Promise<AuthContext>;
}
