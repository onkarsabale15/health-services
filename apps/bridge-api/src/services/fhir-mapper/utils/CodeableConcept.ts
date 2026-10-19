import { CodingEntry } from '../fhir-mapper.types';

const codeToDisplay: Record<string, string> = {
  A: 'Annulled',
  D: 'Divorced',
  I: 'Interlocutory',
  L: 'Legally Separated',
  M: 'Married',
  P: 'Polygamous',
  S: 'Never Married',
  T: 'Domestic partner',
  U: 'unmarried',
  W: 'Widowed',
  MD: 'Medical Doctor (MD)',
  MR: 'Medical Record Number',
};

export class CodeableConcept {
  coding: CodingEntry[];
  text: string;

  constructor(coding: CodingEntry[] = [], text = '') {
    if (!Array.isArray(coding)) {
      throw new Error('Coding must be an array.');
    }
    coding.forEach((code) => {
      if (code.code && codeToDisplay[code.code]) {
        code.display = codeToDisplay[code.code];
      }
    });
    this.coding = coding;
    this.text = text;
  }

  pushCode(code: CodingEntry): void {
    if (!code) {
      throw new Error('Code must be provided.');
    }
    if (code.code && codeToDisplay[code.code]) {
      code.display = codeToDisplay[code.code];
    }
    this.coding.push(code);
  }

  addCoding(coding: CodingEntry): void {
    if (coding?.code && codeToDisplay[coding.code]) {
      coding.display = codeToDisplay[coding.code];
    }
    this.coding.push(coding);
  }
}
