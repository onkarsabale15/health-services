import type {
  Appointment as FhirAppointment,
  Extension,
  Meta,
  Reference,
  Identifier,
  CodeableConcept,
  Period,
} from '@medplum/fhirtypes';
import { BaseResource } from '../BaseResource';

export class Appointment extends BaseResource {
  constructor(id?: string | number) {
    super('Appointment', id);
    this.data.identifier = [];
    this.data.serviceCategory = [];
    this.data.serviceType = [];
    this.data.specialty = [];
    this.data.appointmentType = {};
    this.data.reasonCode = [];
    this.data.reasonReference = [];
    this.data.supportingInformation = [];
    this.data.slot = [];
    this.data.basedOn = [];
    this.data.participant = [];
    this.data.requestedPeriod = [];
    this.data.extension = [];
  }

  addIdentifier(identifier: Identifier): this {
    if (!this.data.identifier) this.data.identifier = [];
    (this.data.identifier as any[]).push(identifier);
    return this;
  }

  setStatus(status: FhirAppointment['status']): this {
    this.data.status = status;
    return this;
  }

  setAppointmentType(type: CodeableConcept): this {
    this.data.appointmentType = type;
    return this;
  }

  setStart(start: string): this {
    this.data.start = start;
    return this;
  }

  setEnd(end: string): this {
    this.data.end = end;
    return this;
  }

  setMinutesDuration(duration: number): this {
    this.data.minutesDuration = duration;
    return this;
  }

  setComment(comment: string): this {
    this.data.comment = comment;
    return this;
  }

  setDescription(description: string): this {
    this.data.description = description;
    return this;
  }

  addParticipant(participant: FhirAppointment['participant'] extends (infer U)[] ? U : never): this {
    if (!this.data.participant) this.data.participant = [];
    (this.data.participant as any[]).push(participant);
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
