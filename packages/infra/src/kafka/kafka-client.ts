import * as tls from 'tls';
import { Kafka, Producer, Consumer, SASLOptions, logLevel as KafkaLogLevel, LogEntry } from 'kafkajs';
import { logger as defaultLogger, ILogger } from '@hs/observability';
import {
  IKafka,
  KafkaConfig,
  KafkaMessage,
  ConsumedMessage,
  MessageHandler,
  SubscribeOptions,
} from './kafka.interface';

class KafkaService implements IKafka {
  private kafka!: Kafka;
  private producer!: Producer;
  private consumers: Consumer[] = [];
  private log: ILogger = defaultLogger;
  private initialized = false;
  private producerConnected = false;

  init(config: KafkaConfig = {}): void {
    const brokers = config.brokers || (process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : undefined);

    if (!brokers || brokers.length === 0) {
      this.log.warn('No Kafka brokers provided — kafka will fail on first operation');
    }

    const clientId = config.clientId || process.env.KAFKA_CLIENT_ID || 'hs-kafka-client';

    const sasl: SASLOptions | undefined = config.sasl
      ? this.buildSaslOptions(config.sasl.mechanism, config.sasl.username, config.sasl.password)
      : process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD
        ? this.buildSaslOptions(
            (process.env.KAFKA_SASL_MECHANISM as 'plain' | 'scram-sha-256' | 'scram-sha-512') || 'plain',
            process.env.KAFKA_SASL_USERNAME,
            process.env.KAFKA_SASL_PASSWORD,
          )
        : undefined;

    const sslConfig = this.buildSslConfig(config.ssl, !!sasl);

    this.kafka = new Kafka({
      clientId,
      brokers: brokers || [],
      ssl: sslConfig,
      ...(sasl ? { sasl } : {}),
      logLevel: this.mapLogLevel(config.logLevel),
      logCreator: () => this.createLogHandler(),
    });

    this.producer = this.kafka.producer();
    this.initialized = true;

    this.log.info('Kafka client initialized', { clientId, brokerCount: brokers?.length ?? 0 });
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.init();
    }
  }

  async connect(): Promise<void> {
    this.ensureInitialized();
    if (!this.producerConnected) {
      await this.producer.connect();
      this.producerConnected = true;
      this.log.info('Kafka producer connected');
    }
  }

  async disconnect(): Promise<void> {
    if (this.producerConnected) {
      await this.producer.disconnect();
      this.producerConnected = false;
      this.log.info('Kafka producer disconnected');
    }

    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
    this.consumers = [];
    this.log.info('All Kafka consumers disconnected');
  }

  async publish<T>(topic: string, messages: KafkaMessage<T>[]): Promise<void> {
    this.ensureInitialized();
    await this.ensureProducerConnected();

    try {
      await this.producer.send({
        topic,
        messages: messages.map((m) => ({
          key: m.key ?? null,
          value: JSON.stringify(m.value),
          headers: m.headers,
        })),
      });
      this.log.debug('Messages published to Kafka', { topic, count: messages.length });
    } catch (error) {
      this.log.error('Failed to publish messages to Kafka', error as Error, { topic, count: messages.length });
      throw error;
    }
  }

  async publishOne<T>(topic: string, value: T, key?: string, headers?: Record<string, string>): Promise<void> {
    await this.publish(topic, [{ key, value, headers }]);
  }

  async subscribe<T>(topic: string, handler: MessageHandler<T>, options: SubscribeOptions): Promise<void> {
    this.ensureInitialized();

    const consumer = this.kafka.consumer({ groupId: options.groupId });
    await consumer.connect();
    this.consumers.push(consumer);

    await consumer.subscribe({ topic, fromBeginning: options.fromBeginning ?? false });

    await consumer.run({
      eachMessage: async ({ topic: msgTopic, partition, message }) => {
        try {
          const consumed: ConsumedMessage<T> = {
            topic: msgTopic,
            partition,
            offset: message.offset,
            key: message.key ? message.key.toString() : undefined,
            value: message.value ? JSON.parse(message.value.toString()) : null,
            headers: this.parseHeaders(message.headers),
            timestamp: message.timestamp,
          };

          await handler(consumed);
        } catch (error) {
          this.log.error('Error processing Kafka message', error as Error, {
            topic: msgTopic,
            partition,
            offset: message.offset,
          });
        }
      },
    });

    this.log.info('Kafka consumer subscribed', { topic, groupId: options.groupId });
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

  private async ensureProducerConnected(): Promise<void> {
    if (!this.producerConnected) {
      await this.producer.connect();
      this.producerConnected = true;
    }
  }

  private mapLogLevel(level?: string): KafkaLogLevel {
    switch (level) {
      case 'NOTHING':
        return KafkaLogLevel.NOTHING;
      case 'ERROR':
        return KafkaLogLevel.ERROR;
      case 'WARN':
        return KafkaLogLevel.WARN;
      case 'INFO':
        return KafkaLogLevel.INFO;
      case 'DEBUG':
        return KafkaLogLevel.DEBUG;
      default:
        return KafkaLogLevel.WARN;
    }
  }

  private createLogHandler(): (entry: LogEntry) => void {
    return (entry: LogEntry) => {
      const { namespace, level, log } = entry;
      const { message, ...extra } = log;
      const meta = { namespace, ...extra };

      switch (level) {
        case KafkaLogLevel.ERROR:
          this.log.error(`[kafkajs] ${message}`, undefined, meta);
          break;
        case KafkaLogLevel.WARN:
          this.log.warn(`[kafkajs] ${message}`, meta);
          break;
        case KafkaLogLevel.INFO:
          this.log.info(`[kafkajs] ${message}`, meta);
          break;
        case KafkaLogLevel.DEBUG:
          this.log.debug(`[kafkajs] ${message}`, meta);
          break;
        default:
          break;
      }
    };
  }

  private buildSslConfig(
    ssl: boolean | { ca?: string } | undefined,
    hasSasl: boolean,
  ): tls.ConnectionOptions | boolean {
    // Explicit object with CA cert
    if (ssl && typeof ssl === 'object') {
      const ca = ssl.ca || process.env.KAFKA_CA_CERT;
      if (ca) {
        return { ca: [ca], rejectUnauthorized: true };
      }
      return true;
    }

    // Env-based CA cert (auto-detect)
    if (process.env.KAFKA_CA_CERT) {
      return { ca: [process.env.KAFKA_CA_CERT], rejectUnauthorized: true };
    }

    // Boolean or fallback: enable SSL if SASL is used
    return ssl ?? hasSasl;
  }

  private buildSaslOptions(
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512',
    username: string,
    password: string,
  ): SASLOptions {
    switch (mechanism) {
      case 'scram-sha-256':
        return { mechanism: 'scram-sha-256', username, password };
      case 'scram-sha-512':
        return { mechanism: 'scram-sha-512', username, password };
      case 'plain':
      default:
        return { mechanism: 'plain', username, password };
    }
  }

  private parseHeaders(
    headers?: Record<string, Buffer | string | (Buffer | string)[] | undefined>,
  ): Record<string, string> | undefined {
    if (!headers) return undefined;

    const parsed: Record<string, string> = {};
    for (const [key, val] of Object.entries(headers)) {
      if (val === undefined) continue;
      if (Buffer.isBuffer(val)) {
        parsed[key] = val.toString();
      } else if (Array.isArray(val)) {
        const first = val[0];
        parsed[key] = first ? (Buffer.isBuffer(first) ? first.toString() : first) : '';
      } else {
        parsed[key] = val;
      }
    }
    return parsed;
  }
}

export const kafka: IKafka & { init: (config?: KafkaConfig) => void } = new KafkaService();
