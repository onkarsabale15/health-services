export interface ISecretsProvider {
  getSecretValue<T = unknown>(secretName: string): Promise<T>;
  putSecretValue(secretName: string, value: string): Promise<void>;
  deleteSecretValue(secretName: string): Promise<void>;
}
