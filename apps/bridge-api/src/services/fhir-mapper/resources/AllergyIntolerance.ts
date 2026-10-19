import type { AllergyIntolerance as FhirAllergyIntolerance, Extension, Meta, Annotation } from '@medplum/fhirtypes';
import { BaseResource } from '../BaseResource';

export interface AllergyReaction {
  substance?: any;
  manifestation: any[];
  description?: string;
  onset?: string;
  severity?: string;
  exposureRoute?: any;
  note?: Annotation[];
}

export class AllergyIntolerance extends BaseResource {
  constructor(id?: string | number) {
    super('AllergyIntolerance', id);
    this.data.identifier = [];
    this.data.category = [];
    this.data.reaction = [];
    this.data.extension = [];
    this.data.note = [];
  }

  addIdentifier(identifier: FhirAllergyIntolerance['identifier'] extends (infer U)[] ? U : never): this {
    if (!this.data.identifier) this.data.identifier = [];
    (this.data.identifier as any[]).push(identifier);
    return this;
  }

  setClinicalStatus(status: FhirAllergyIntolerance['clinicalStatus']): this {
    this.data.clinicalStatus = status;
    return this;
  }

  setVerificationStatus(status: FhirAllergyIntolerance['verificationStatus']): this {
    this.data.verificationStatus = status;
    return this;
  }

  setType(type: FhirAllergyIntolerance['type']): this {
    this.data.type = type;
    return this;
  }

  setCategory(category: FhirAllergyIntolerance['category']): this {
    this.data.category = category;
    return this;
  }

  setCriticality(criticality: FhirAllergyIntolerance['criticality']): this {
    this.data.criticality = criticality;
    return this;
  }

  setCode(code: FhirAllergyIntolerance['code']): this {
    this.data.code = code;
    return this;
  }

  setPatient(patient: FhirAllergyIntolerance['patient']): this {
    this.data.patient = patient;
    return this;
  }

  setOnset(
    onset:
      | FhirAllergyIntolerance['onsetDateTime']
      | FhirAllergyIntolerance['onsetAge']
      | FhirAllergyIntolerance['onsetPeriod']
      | FhirAllergyIntolerance['onsetRange']
      | FhirAllergyIntolerance['onsetString'],
  ): this {
    if (typeof onset === 'string') {
      this.data.onsetDateTime = onset;
    } else {
      Object.assign(this.data, { onset });
    }
    return this;
  }

  setRecordedDate(recordedDate: string): this {
    this.data.recordedDate = recordedDate;
    return this;
  }

  setRecorder(recorder: FhirAllergyIntolerance['recorder']): this {
    this.data.recorder = recorder;
    return this;
  }

  setAsserter(asserter: FhirAllergyIntolerance['asserter']): this {
    this.data.asserter = asserter;
    return this;
  }

  setLastOccurrence(lastOccurrence: string): this {
    this.data.lastOccurrence = lastOccurrence;
    return this;
  }

  addNote(note: Annotation): this {
    if (!this.data.note) this.data.note = [];
    (this.data.note as any[]).push(note);
    return this;
  }

  addReaction(reaction: AllergyReaction): this {
    if (!this.data.reaction) this.data.reaction = [];
    (this.data.reaction as any[]).push(reaction);
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
