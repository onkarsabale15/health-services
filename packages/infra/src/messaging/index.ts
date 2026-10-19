export type {
  IMessageBroker,
  MessageBrokerConfig,
  Message,
  ReceivedMessage,
  MessageHandler,
  SubscribeOptions,
} from './messaging.interface';

export { KafkaMessageBroker } from './providers/kafka.provider';

// Default singleton — Kafka provider. Swap this to change the backend globally.
import { KafkaMessageBroker } from './providers/kafka.provider';

export const messaging: import('./messaging.interface').IMessageBroker & {
  init: (config?: import('./messaging.interface').MessageBrokerConfig) => void;
} = new KafkaMessageBroker();
