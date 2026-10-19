import type { Condition as FhirCondition, Extension, Meta, Annotation, Reference } from '@medplum/fhirtypes';
import { BaseResource } from '../BaseResource';

export class Condition extends BaseResource {
  constructor(id?: string | number) {
    super('Condition', id);
    this.data.identifier = [];
    this.data.category = [];
    this.data.extension = [];
    this.data.note = [];
  }

  addIdentifier(identifier: FhirCondition['identifier'] extends (infer U)[] ? U : never): this {
    if (!this.data.identifier) this.data.identifier = [];
    (this.data.identifier as any[]).push(identifier);
    return this;
  }

  setClinicalStatus(status: FhirCondition['clinicalStatus']): this {
    this.data.clinicalStatus = status;
    return this;
  }

  setVerificationStatus(status: FhirCondition['verificationStatus']): this {
    this.data.verificationStatus = status;
    return this;
  }

  setCategory(category: FhirCondition['category']): this {
    this.data.category = category;
    return this;
  }

  setSeverity(severity: FhirCondition['severity']): this {
    this.data.severity = severity;
    return this;
  }

  setCode(code: FhirCondition['code']): this {
    this.data.code = code;
    return this;
  }

  setBodySite(bodySite: FhirCondition['bodySite']): this {
    this.data.bodySite = bodySite;
    return this;
  }

  setSubject(subject: Reference): this {
    this.data.subject = subject;
    return this;
  }

  setEncounter(encounter: Reference): this {
    this.data.encounter = encounter;
    return this;
  }

  setOnset(
    onset:
      | FhirCondition['onsetDateTime']
      | FhirCondition['onsetAge']
      | FhirCondition['onsetPeriod']
      | FhirCondition['onsetRange']
      | FhirCondition['onsetString'],
  ): this {
    if (typeof onset === 'string') {
      this.data.onsetDateTime = onset;
    } else {
      Object.assign(this.data, { onset });
    }
    return this;
  }

  setAbatement(
    abatement:
      | FhirCondition['abatementDateTime']
      | FhirCondition['abatementAge']
      | FhirCondition['abatementPeriod']
      | FhirCondition['abatementRange']
      | FhirCondition['abatementString'],
  ): this {
    if (typeof abatement === 'string') {
      this.data.abatementDateTime = abatement;
    } else {
      Object.assign(this.data, { abatement });
    }
    return this;
  }

  setRecordedDate(recordedDate: string): this {
    this.data.recordedDate = recordedDate;
    return this;
  }

  setRecorder(recorder: Reference): this {
    this.data.recorder = recorder;
    return this;
  }

  setAsserter(asserter: Reference): this {
    this.data.asserter = asserter;
    return this;
  }

  addNote(note: Annotation): this {
    if (!this.data.note) this.data.note = [];
    (this.data.note as any[]).push(note);
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
