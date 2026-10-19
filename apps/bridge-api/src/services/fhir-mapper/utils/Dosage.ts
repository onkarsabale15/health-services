import { CodeableConcept } from './CodeableConcept';
import { Quantity } from './Quantity';
import { DoseAndRate } from '../fhir-mapper.types';

export class Dosage {
  text: string | null;
  route: CodeableConcept | null;
  doseAndRate: DoseAndRate[];

  constructor() {
    this.text = null;
    this.route = null;
    this.doseAndRate = [];
  }

  setText(text: string): void {
    if (typeof text !== 'string') {
      throw new Error('Text must be a string.');
    }
    this.text = text;
  }

  setRoute(codeableConcept: CodeableConcept): void {
    if (!(codeableConcept instanceof CodeableConcept)) {
      throw new Error('Route must be an instance of CodeableConcept.');
    }
    this.route = codeableConcept;
  }

  addDoseAndRate({ doseQuantity }: DoseAndRate): void {
    if (doseQuantity && !(doseQuantity instanceof Quantity)) {
      throw new Error('RateQuantity must be an instance of Quantity.');
    }
    this.doseAndRate.push({ doseQuantity });
  }
}
