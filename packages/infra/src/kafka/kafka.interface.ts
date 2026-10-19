export interface KafkaConfig {
  brokers?: string[];
  clientId?: string;
  ssl?: boolean | { ca?: string };
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  logLevel?: 'NOTHING' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
}

export interface KafkaMessage<T = unknown> {
  key?: string;
  value: T;
  headers?: Record<string, string>;
}

export interface ConsumedMessage<T = unknown> {
  topic: string;
  partition: number;
  offset: string;
  key?: string;
  value: T;
  headers?: Record<string, string>;
  timestamp: string;
}

export type MessageHandler<T = unknown> = (message: ConsumedMessage<T>) => Promise<void>;

export interface SubscribeOptions {
  groupId: string;
  fromBeginning?: boolean;
  concurrency?: number;
}

export interface IKafka {
  init(config?: KafkaConfig): void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish<T>(topic: string, messages: KafkaMessage<T>[]): Promise<void>;
  publishOne<T>(topic: string, value: T, key?: string, headers?: Record<string, string>): Promise<void>;
  subscribe<T>(topic: string, handler: MessageHandler<T>, options: SubscribeOptions): Promise<void>;
  isHealthy(): Promise<boolean>;
}
