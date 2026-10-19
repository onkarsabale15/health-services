import type {
  Observation as FhirObservation,
  Extension,
  Meta,
  Reference,
  Identifier,
  CodeableConcept,
  Period,
  Quantity,
} from '@medplum/fhirtypes';
import { BaseResource } from '../BaseResource';

export interface ObservationComponent {
  code: CodeableConcept;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: any;
  valueRatio?: any;
  valueSampledData?: any;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  referenceRange?: any[];
}

export class Observation extends BaseResource {
  constructor(id?: string | number) {
    super('Observation', id);
    this.data.identifier = [];
    this.data.basedOn = [];
    this.data.partOf = [];
    this.data.category = [];
    this.data.focus = [];
    this.data.performer = [];
    this.data.interpretation = [];
    this.data.note = [];
    this.data.referenceRange = [];
    this.data.hasMember = [];
    this.data.derivedFrom = [];
    this.data.component = [];
    this.data.extension = [];
  }

  addIdentifier(identifier: Identifier): this {
    if (!this.data.identifier) this.data.identifier = [];
    (this.data.identifier as any[]).push(identifier);
    return this;
  }

  setStatus(status: FhirObservation['status']): this {
    this.data.status = status;
    return this;
  }

  addCategory(category: CodeableConcept): this {
    if (!this.data.category) this.data.category = [];
    (this.data.category as any[]).push(category);
    return this;
  }

  setCode(code: CodeableConcept): this {
    this.data.code = code;
    return this;
  }

  setSubject(subject: Reference): this {
    this.data.subject = subject;
    return this;
  }

  setEffective(effective: string | Period): this {
    if (typeof effective === 'string') {
      this.data.effectiveDateTime = effective;
    } else {
      this.data.effectivePeriod = effective;
    }
    return this;
  }

  setIssued(issued: string): this {
    this.data.issued = issued;
    return this;
  }

  addPerformer(performer: Reference): this {
    if (!this.data.performer) this.data.performer = [];
    (this.data.performer as any[]).push(performer);
    return this;
  }

  setValueQuantity(valueQuantity: Quantity): this {
    this.data.valueQuantity = valueQuantity;
    return this;
  }

  setValueCodeableConcept(valueCodeableConcept: CodeableConcept): this {
    this.data.valueCodeableConcept = valueCodeableConcept;
    return this;
  }

  setValueString(valueString: string): this {
    this.data.valueString = valueString;
    return this;
  }

  addComponent(component: ObservationComponent): this {
    if (!this.data.component) this.data.component = [];
    (this.data.component as any[]).push(component);
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
