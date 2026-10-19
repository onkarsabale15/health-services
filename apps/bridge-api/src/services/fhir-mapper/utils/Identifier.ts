import { IdentifierUse } from '../fhir-mapper.types';
import { CodeableConcept } from './CodeableConcept';

const ALLOWED_IDENTIFIER_USE: Set<IdentifierUse> = new Set(['usual', 'official', 'temp', 'secondary', 'old']);

export interface IdentifierData {
  use?: IdentifierUse;
  type?: CodeableConcept;
  system?: string;
  value?: string;
}

export class Identifier {
  use?: IdentifierUse;
  type?: CodeableConcept;
  system?: string;
  value?: string;

  constructor(identifier: IdentifierData = {}) {
    if (identifier.use && !ALLOWED_IDENTIFIER_USE.has(identifier.use)) {
      throw new Error(`Invalid identifier use: ${identifier.use}`);
    }
    this.use = identifier.use;

    if (identifier.type && !(identifier.type instanceof CodeableConcept)) {
      throw new Error('Identifier type must be a CodeableConcept');
    }
    this.type = identifier.type;

    if (identifier.system && typeof identifier.system !== 'string') {
      throw new Error('Identifier system must be a string');
    }
    this.system = identifier.system;

    if (identifier.value && typeof identifier.value !== 'string') {
      throw new Error('Identifier value must be a string');
    }
    this.value = identifier.value;
  }

  toJson(): IdentifierData {
    return {
      use: this.use,
      type: this.type,
      system: this.system,
      value: this.value,
    };
  }
}
