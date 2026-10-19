/**
 * Generic async messaging abstraction.
 *
 * Designed to support multiple backends: Kafka, RabbitMQ, BullMQ, Redis Pub/Sub, SQS.
 * Consumers implement IMessageBroker; callers depend only on this interface (DIP).
 *
 * Terminology:
 *   channel  = topic (Kafka), queue (RabbitMQ/SQS), channel (Redis Pub/Sub)
 *   groupId  = consumer group (Kafka), queue consumer tag (RabbitMQ), worker name (BullMQ)
 */

export interface MessageBrokerConfig {
  /** Broker-specific connection info (e.g., brokers for Kafka, URL for RabbitMQ/Redis) */
  url?: string;
  /** Client identifier for this producer/consumer instance */
  clientId?: string;
  /** Extra broker-specific options */
  [key: string]: unknown;
}

export interface Message<T = unknown> {
  /** Routing key (Kafka partition key, RabbitMQ routing key) */
  key?: string;
  /** Message payload — JSON-serialized automatically */
  value: T;
  /** Metadata headers */
  headers?: Record<string, string>;
}

export interface ReceivedMessage<T = unknown> {
  /** Channel the message was received from */
  channel: string;
  /** Routing key */
  key?: string;
  /** Deserialized message payload */
  value: T;
  /** Metadata headers */
  headers?: Record<string, string>;
  /** When the message was produced */
  timestamp: string;
  /** Broker-specific metadata (partition, offset for Kafka; deliveryTag for RabbitMQ, etc.) */
  metadata?: Record<string, unknown>;
}

export type MessageHandler<T = unknown> = (message: ReceivedMessage<T>) => Promise<void>;

export interface SubscribeOptions {
  /** Consumer group identifier */
  groupId: string;
  /** Whether to replay from the beginning of the channel (default: false) */
  fromBeginning?: boolean;
}

export interface IMessageBroker {
  /** Initialize the broker with config. Can be called before connect(). */
  init(config?: MessageBrokerConfig): void;

  /** Establish connection to the broker. */
  connect(): Promise<void>;

  /** Disconnect from the broker. Cleans up all producers and consumers. */
  disconnect(): Promise<void>;

  /** Publish a batch of messages to a channel. */
  publish<T>(channel: string, messages: Message<T>[]): Promise<void>;

  /** Publish a single message to a channel (convenience wrapper). */
  publishOne<T>(channel: string, value: T, key?: string, headers?: Record<string, string>): Promise<void>;

  /** Subscribe to a channel. Handler is called for each received message. */
  subscribe<T>(channel: string, handler: MessageHandler<T>, options: SubscribeOptions): Promise<void>;

  /** Check if the broker connection is healthy. */
  isHealthy(): Promise<boolean>;
}
