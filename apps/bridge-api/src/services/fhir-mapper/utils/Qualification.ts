import { CodeableConcept } from './CodeableConcept';
import { Identifier } from './Identifier';

export interface QualificationEntry {
  code?: CodeableConcept;
  identifier?: Identifier[];
}

export class Qualification {
  qualification: QualificationEntry[];

  constructor() {
    this.qualification = [];
  }

  addQualification(qualification: QualificationEntry = {}): void {
    const { code, identifier } = qualification;

    if (code && !(code instanceof CodeableConcept)) {
      throw new Error('Qualification code must be an instance of CodeableConcept.');
    }

    if (identifier) {
      if (!Array.isArray(identifier)) {
        throw new Error('Qualification identifier must be an array of Identifier instances.');
      }
      for (const id of identifier) {
        if (!(id instanceof Identifier)) {
          throw new Error('Each identifier must be an instance of Identifier.');
        }
      }
    }

    this.qualification.push(qualification);
  }
}
