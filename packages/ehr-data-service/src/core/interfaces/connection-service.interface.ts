import type { ConnectionData } from './connection-data.interface';

export interface IConnectionService {
  createConnection(payload: Record<string, unknown>, authContext?: Record<string, unknown>): Promise<ConnectionData>;
  getConnection(connectionId: string): Promise<ConnectionData>;
  deleteConnection(connectionId: string, connectionData?: unknown): Promise<void>;
}
