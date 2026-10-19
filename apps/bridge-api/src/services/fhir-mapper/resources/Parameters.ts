import type { Parameters as FhirParameters, Extension, Meta } from '@medplum/fhirtypes';
import { BaseResource } from '../BaseResource';

export class Parameters extends BaseResource {
  constructor(id?: string | number) {
    super('Parameters', id);
    this.data.parameter = [];
    this.data.extension = [];
  }

  addParameter(parameter: FhirParameters['parameter'] extends (infer U)[] ? U : never): this {
    if (!this.data.parameter) this.data.parameter = [];
    (this.data.parameter as any[]).push(parameter);
    return this;
  }

  addExtension(extension: Extension): this {
    if (!this.data.extension) this.data.extension = [];
    (this.data.extension as any[]).push(extension);
    return this;
  }

  setMeta(meta: Meta): this {
    this.data.meta = meta;
    return this;
  }
}
