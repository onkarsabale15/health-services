import { ExtensionProps } from '../fhir-mapper.types';
import { Reference } from './Reference';

export class Extension {
  url: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueReference?: Reference;

  constructor({ url, valueString, valueBoolean, valueReference }: ExtensionProps) {
    this.url = url;
    this.valueString = valueString;
    this.valueBoolean = valueBoolean;
    this.valueReference = valueReference;
  }
}
