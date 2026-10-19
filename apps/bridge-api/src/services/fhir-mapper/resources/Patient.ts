import type {
  Patient as FhirPatient,
  HumanName,
  Address,
  ContactPoint,
  Extension,
  Meta,
  CodeableConcept as FhirCodeableConcept,
} from '@medplum/fhirtypes';
import { BaseResource } from '../BaseResource';
import { CodeableConcept } from '../utils/CodeableConcept';

export interface PatientCommunication {
  language?: CodeableConcept;
  preferred?: boolean;
}

export class Patient extends BaseResource {
  constructor(id?: string | number) {
    super('Patient', id);
    this.data.identifier = [];
    this.data.name = [];
    this.data.address = [];
    this.data.telecom = [];
    this.data.contact = [];
    this.data.extension = [];
    this.data.qualification = [];
    this.data.communication = [];
  }

  addIdentifier(identifier: FhirPatient['identifier'] extends (infer U)[] ? U : never): this {
    if (!this.data.identifier) this.data.identifier = [];
    (this.data.identifier as any[]).push(identifier);
    return this;
  }

  addName(name: HumanName): this {
    if (!this.data.name) this.data.name = [];
    (this.data.name as any[]).push(name);
    return this;
  }

  addAddress(address: Address): this {
    if (!this.data.address) this.data.address = [];
    (this.data.address as any[]).push(address);
    return this;
  }

  addTelecom(telecom: ContactPoint): this {
    if (!this.data.telecom) this.data.telecom = [];
    (this.data.telecom as any[]).push(telecom);
    return this;
  }

  setGender(gender: FhirPatient['gender']): this {
    this.data.gender = gender;
    return this;
  }

  isActive(active: boolean): this {
    this.data.active = active;
    return this;
  }

  setBirthDate(birthDate: string): this {
    this.data.birthDate = birthDate;
    return this;
  }

  setDeceased(deceased: boolean | string): this {
    this.data.deceasedBoolean = typeof deceased === 'boolean' ? deceased : undefined;
    this.data.deceasedDateTime = typeof deceased === 'string' ? deceased : undefined;
    return this;
  }

  addGeneralPractitioner(gp: FhirPatient['generalPractitioner'] extends (infer U)[] ? U : never): this {
    if (!this.data.generalPractitioner) this.data.generalPractitioner = [];
    (this.data.generalPractitioner as any[]).push(gp);
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

  setMaritalStatus(maritalStatus: CodeableConcept | FhirCodeableConcept): this {
    this.data.maritalStatus = maritalStatus;
    return this;
  }

  addCommunication(communication: PatientCommunication = {}): this {
    if (!this.data.communication) this.data.communication = [];
    (this.data.communication as any[]).push(communication);
    return this;
  }
}
