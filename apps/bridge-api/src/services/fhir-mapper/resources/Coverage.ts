import type {
  Coverage as FhirCoverage,
  Extension,
  Meta,
  Reference,
  Identifier,
  CodeableConcept,
  Period,
  ContactPoint,
  Address,
  HumanName,
} from '@medplum/fhirtypes';
import { BaseResource } from '../BaseResource';

export class Coverage extends BaseResource {
  constructor(id?: string | number) {
    super('Coverage', id);
    this.data.identifier = [];
    this.data.type = {};
    this.data.subscriber = {};
    this.data.subscriberId = undefined;
    this.data.beneficiary = {};
    this.data.dependent = undefined;
    this.data.relationship = {};
    this.data.period = {};
    this.data.payor = [];
    this.data.class = [];
    this.data.order = undefined;
    this.data.network = undefined;
    this.data.costToBeneficiary = [];
    this.data.subrogation = undefined;
    this.data.contract = [];
    this.data.extension = [];
    this.data.status = undefined;
  }

  addIdentifier(identifier: Identifier): this {
    if (!this.data.identifier) this.data.identifier = [];
    (this.data.identifier as any[]).push(identifier);
    return this;
  }

  setStatus(status: FhirCoverage['status']): this {
    const ALLOWED_STATUS_VALUES: FhirCoverage['status'][] = ['active', 'cancelled', 'draft', 'entered-in-error'];
    if (!status || !ALLOWED_STATUS_VALUES.includes(status)) {
      throw new Error(`Invalid status value: ${status}`);
    }
    this.data.status = status;
    return this;
  }

  setType(type: CodeableConcept): this {
    this.data.type = type;
    return this;
  }

  setSubscriber(subscriber: Reference): this {
    this.data.subscriber = subscriber;
    return this;
  }

  setSubscriberId(id: string): this {
    this.data.subscriberId = id;
    return this;
  }

  setBeneficiary(beneficiary: Reference): this {
    this.data.beneficiary = beneficiary;
    return this;
  }

  setRelationship(relationship: CodeableConcept): this {
    this.data.relationship = relationship;
    return this;
  }

  setPeriod(period: Period): this {
    this.data.period = period;
    return this;
  }

  addPayor(payor: Reference): this {
    if (!this.data.payor) this.data.payor = [];
    (this.data.payor as any[]).push(payor);
    return this;
  }

  addClass(classItem: FhirCoverage['class'] extends (infer U)[] ? U : never): this {
    if (!this.data.class) this.data.class = [];
    (this.data.class as any[]).push(classItem);
    return this;
  }

  setOrder(order: number): this {
    this.data.order = order;
    return this;
  }

  addCostToBeneficiary(cost: FhirCoverage['costToBeneficiary'] extends (infer U)[] ? U : never): this {
    if (!this.data.costToBeneficiary) this.data.costToBeneficiary = [];
    (this.data.costToBeneficiary as any[]).push(cost);
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
