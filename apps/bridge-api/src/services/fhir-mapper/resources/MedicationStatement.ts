import type {
  MedicationStatement as FhirMedicationStatement,
  Extension,
  Meta,
  Reference,
  Identifier,
  CodeableConcept,
  Annotation,
} from '@medplum/fhirtypes';
import { BaseResource } from '../BaseResource';

export class MedicationStatement extends BaseResource {
  constructor(id?: string | number) {
    super('MedicationStatement', id);
    this.data.identifier = [];
    this.data.basedOn = [];
    this.data.partOf = [];
    this.data.category = [];
    this.data.reasonCode = [];
    this.data.reasonReference = [];
    this.data.note = [];
    this.data.dosage = [];
    this.data.extension = [];
  }

  addIdentifier(identifier: Identifier): this {
    if (!this.data.identifier) this.data.identifier = [];
    (this.data.identifier as any[]).push(identifier);
    return this;
  }

  setStatus(status: FhirMedicationStatement['status']): this {
    this.data.status = status;
    return this;
  }

  setMedication(medication: CodeableConcept | Reference): this {
    if ((medication as Reference).reference) {
      this.data.medicationReference = medication;
    } else {
      this.data.medicationCodeableConcept = medication;
    }
    return this;
  }

  setSubject(subject: Reference): this {
    this.data.subject = subject;
    return this;
  }

  setContext(context: Reference): this {
    this.data.context = context;
    return this;
  }

  setEffective(effective: string | any): this {
    if (typeof effective === 'string') {
      this.data.effectiveDateTime = effective;
    } else {
      this.data.effectivePeriod = effective;
    }
    return this;
  }

  setDateAsserted(dateAsserted: string): this {
    this.data.dateAsserted = dateAsserted;
    return this;
  }

  setInformationSource(source: Reference): this {
    this.data.informationSource = source;
    return this;
  }

  addNote(note: Annotation): this {
    if (!this.data.note) this.data.note = [];
    (this.data.note as any[]).push(note);
    return this;
  }

  addDosage(dosage: any): this {
    if (!this.data.dosage) this.data.dosage = [];
    (this.data.dosage as any[]).push(dosage);
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
