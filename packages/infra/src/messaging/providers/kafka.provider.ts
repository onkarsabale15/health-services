/**
 * Kafka implementation of IMessageBroker.
 *
 * Uses KafkaJS under the hood. Channels map to Kafka topics.
 * Keys map to Kafka partition keys (ordering within partition).
 * GroupIds map to Kafka consumer groups.
 */
import * as tls from 'tls';
import { Kafka, Producer, Consumer, SASLOptions, logLevel as KafkaLogLevel, LogEntry } from 'kafkajs';
import { logger as defaultLogger } from '@hs/observability';
import type {
  IMessageBroker,
  MessageBrokerConfig,
  Message,
  ReceivedMessage,
  MessageHandler,
  SubscribeOptions,
} from '../messaging.interface';

export class KafkaMessageBroker implements IMessageBroker {
  private kafka!: Kafka;
  private producer!: Producer;
  private consumers: Consumer[] = [];
  private initialized = false;
  private producerConnected = false;

  init(config: MessageBrokerConfig = {}): void {
    const brokers =
      (config.brokers as string[]) || (process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : undefined);

    if (!brokers || brokers.length === 0) {
      defaultLogger.warn('No Kafka brokers provided — messaging will fail on first operation');
    }

    const clientId = config.clientId || process.env.KAFKA_CLIENT_ID || 'hs-messaging';

    const sasl = this.buildSasl(config);
    const ssl = this.buildSsl(config, !!sasl);

    this.kafka = new Kafka({
      clientId,
      brokers: brokers || [],
      ssl,
      ...(sasl ? { sasl } : {}),
      logLevel: KafkaLogLevel.WARN,
      logCreator: () => this.logHandler(),
    });

    this.producer = this.kafka.producer();
    this.initialized = true;

    defaultLogger.info('Kafka message broker initialized', { clientId, brokerCount: brokers?.length ?? 0 });
  }

  private ensureInitialized(): void {
    if (!this.initialized) this.init();
  }

  async connect(): Promise<void> {
    this.ensureInitialized();
    if (!this.producerConnected) {
      await this.producer.connect();
      this.producerConnected = true;
      defaultLogger.info('Kafka producer connected');
    }
  }

  async disconnect(): Promise<void> {
    if (this.producerConnected) {
      await this.producer.disconnect();
      this.producerConnected = false;
      defaultLogger.info('Kafka producer disconnected');
    }
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
    this.consumers = [];
    defaultLogger.info('All Kafka consumers disconnected');
  }

  async publish<T>(channel: string, messages: Message<T>[]): Promise<void> {
    this.ensureInitialized();
    if (!this.producerConnected) {
      await this.producer.connect();
      this.producerConnected = true;
    }

    try {
      await this.producer.send({
        topic: channel,
        messages: messages.map((m) => ({
          key: m.key ?? null,
          value: JSON.stringify(m.value),
          headers: m.headers,
        })),
      });
      defaultLogger.debug('Messages published', { channel, count: messages.length });
    } catch (error) {
      defaultLogger.error('Failed to publish messages', error as Error, { channel, count: messages.length });
      throw error;
    }
  }

  async publishOne<T>(channel: string, value: T, key?: string, headers?: Record<string, string>): Promise<void> {
    await this.publish(channel, [{ key, value, headers }]);
  }

  async subscribe<T>(channel: string, handler: MessageHandler<T>, options: SubscribeOptions): Promise<void> {
    this.ensureInitialized();

    const consumer = this.kafka.consumer({ groupId: options.groupId });
    await consumer.connect();
    this.consumers.push(consumer);

    await consumer.subscribe({ topic: channel, fromBeginning: options.fromBeginning ?? false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const received: ReceivedMessage<T> = {
            channel: topic,
            key: message.key ? message.key.toString() : undefined,
            value: message.value ? JSON.parse(message.value.toString()) : null,
            headers: this.parseHeaders(message.headers),
            timestamp: message.timestamp,
            metadata: { partition, offset: message.offset },
          };
          await handler(received);
        } catch (error) {
          defaultLogger.error('Error processing message', error as Error, {
            channel: topic,
            partition,
            offset: message.offset,
          });
        }
      },
    });

    defaultLogger.info('Subscribed to channel', { channel, groupId: options.groupId });
  }

  async isHealthy(): Promise<boolean> {
    try {
      this.ensureInitialized();
      const admin = this.kafka.admin();
      await admin.connect();
      await admin.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  // --- Private helpers ---

  private buildSasl(config: MessageBrokerConfig): SASLOptions | undefined {
    const saslConfig = config.sasl as { mechanism?: string; username?: string; password?: string } | undefined;
    const username = saslConfig?.username || process.env.KAFKA_SASL_USERNAME;
    const password = saslConfig?.password || process.env.KAFKA_SASL_PASSWORD;
    if (!username || !password) return undefined;

    const mechanism = (saslConfig?.mechanism || process.env.KAFKA_SASL_MECHANISM || 'plain') as
      | 'plain'
      | 'scram-sha-256'
      | 'scram-sha-512';
    return { mechanism, username, password };
  }

  private buildSsl(config: MessageBrokerConfig, hasSasl: boolean): tls.ConnectionOptions | boolean {
    const ca = (config.ssl as { ca?: string })?.ca || process.env.KAFKA_CA_CERT;
    if (ca) return { ca: [ca], rejectUnauthorized: true };
    if (config.ssl === true) return true;
    return hasSasl; // enable SSL if SASL is used
  }

  private logHandler(): (entry: LogEntry) => void {
    return (entry: LogEntry) => {
      const { namespace, level, log } = entry;
      const { message, ...extra } = log;
      const meta = { namespace, ...extra };
      switch (level) {
        case KafkaLogLevel.ERROR:
          defaultLogger.error(`[kafka] ${message}`, undefined, meta);
          break;
        case KafkaLogLevel.WARN:
          defaultLogger.warn(`[kafka] ${message}`, meta);
          break;
        case KafkaLogLevel.INFO:
          defaultLogger.info(`[kafka] ${message}`, meta);
          break;
        case KafkaLogLevel.DEBUG:
          defaultLogger.debug(`[kafka] ${message}`, meta);
          break;
      }
    };
  }

  private parseHeaders(
    headers?: Record<string, Buffer | string | (Buffer | string)[] | undefined>,
  ): Record<string, string> | undefined {
    if (!headers) return undefined;
    const parsed: Record<string, string> = {};
    for (const [key, val] of Object.entries(headers)) {
      if (val === undefined) continue;
      if (Buffer.isBuffer(val)) parsed[key] = val.toString();
      else if (Array.isArray(val)) {
        const first = val[0];
        parsed[key] = first ? (Buffer.isBuffer(first) ? first.toString() : first) : '';
      } else parsed[key] = val;
    }
    return parsed;
  }
}
