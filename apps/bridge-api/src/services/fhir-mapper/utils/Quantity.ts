import { QuantityProps } from '../fhir-mapper.types';

export class Quantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;

  constructor({ value, unit, system, code }: QuantityProps = {}) {
    this.value = value;
    this.unit = unit;
    this.system = system;
    this.code = code;
  }

  changeValue(value: number): void {
    this.value = value;
  }

  changeUnit(unit: string): void {
    this.unit = unit;
  }

  changeSystem(system: string): void {
    this.system = system;
  }

  changeCode(code: string): void {
    this.code = code;
  }
}
