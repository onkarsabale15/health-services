import type {
  Practitioner as FhirPractitioner,
  Extension,
  Meta,
  Address,
  ContactPoint,
  HumanName,
  Identifier,
} from '@medplum/fhirtypes';
import { BaseResource } from '../BaseResource';

export class Practitioner extends BaseResource {
  constructor(id?: string | number) {
    super('Practitioner', id);
    this.data.identifier = [];
    this.data.name = [];
    this.data.telecom = [];
    this.data.address = [];
    this.data.qualification = [];
    this.data.communication = [];
    this.data.extension = [];
  }

  addIdentifier(identifier: Identifier): this {
    if (!this.data.identifier) this.data.identifier = [];
    (this.data.identifier as any[]).push(identifier);
    return this;
  }

  isActive(active: boolean): this {
    this.data.active = active;
    return this;
  }

  addName(name: HumanName): this {
    if (!this.data.name) this.data.name = [];
    (this.data.name as any[]).push(name);
    return this;
  }

  addTelecom(telecom: ContactPoint): this {
    if (!this.data.telecom) this.data.telecom = [];
    (this.data.telecom as any[]).push(telecom);
    return this;
  }

  addAddress(address: Address): this {
    if (!this.data.address) this.data.address = [];
    (this.data.address as any[]).push(address);
    return this;
  }

  setGender(gender: FhirPractitioner['gender']): this {
    this.data.gender = gender;
    return this;
  }

  setBirthDate(birthDate: string): this {
    this.data.birthDate = birthDate;
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
