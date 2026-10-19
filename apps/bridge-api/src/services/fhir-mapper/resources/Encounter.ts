import type {
  Encounter as FhirEncounter,
  Extension,
  Meta,
  Reference,
  Identifier,
  CodeableConcept,
  Period,
} from '@medplum/fhirtypes';
import { BaseResource } from '../BaseResource';

export class Encounter extends BaseResource {
  constructor(id?: string | number) {
    super('Encounter', id);
    this.data.identifier = [];
    this.data.statusHistory = [];
    this.data.classHistory = [];
    this.data.type = [];
    this.data.episodeOfCare = [];
    this.data.basedOn = [];
    this.data.participant = [];
    this.data.appointment = [];
    this.data.reasonCode = [];
    this.data.reasonReference = [];
    this.data.diagnosis = [];
    this.data.account = [];
    this.data.hospitalization = {};
    this.data.location = [];
    this.data.extension = [];
  }

  addIdentifier(identifier: Identifier): this {
    if (!this.data.identifier) this.data.identifier = [];
    (this.data.identifier as any[]).push(identifier);
    return this;
  }

  setStatus(status: FhirEncounter['status']): this {
    this.data.status = status;
    return this;
  }

  setClass(encounterClass: FhirEncounter['class']): this {
    this.data.class = encounterClass;
    return this;
  }

  addType(type: CodeableConcept): this {
    if (!this.data.type) this.data.type = [];
    (this.data.type as any[]).push(type);
    return this;
  }

  setSubject(subject: Reference): this {
    this.data.subject = subject;
    return this;
  }

  setPeriod(period: Period): this {
    this.data.period = period;
    return this;
  }

  addReasonCode(reasonCode: CodeableConcept): this {
    if (!this.data.reasonCode) this.data.reasonCode = [];
    (this.data.reasonCode as any[]).push(reasonCode);
    return this;
  }

  setServiceProvider(serviceProvider: Reference): this {
    this.data.serviceProvider = serviceProvider;
    return this;
  }

  addAppointment(appointment: Reference): this {
    if (!this.data.appointment) this.data.appointment = [];
    (this.data.appointment as any[]).push(appointment);
    return this;
  }

  addParticipant(participant: FhirEncounter['participant'] extends (infer U)[] ? U : never): this {
    if (!this.data.participant) this.data.participant = [];
    (this.data.participant as any[]).push(participant);
    return this;
  }

  addLocation(location: FhirEncounter['location'] extends (infer U)[] ? U : never): this {
    if (!this.data.location) this.data.location = [];
    (this.data.location as any[]).push(location);
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
