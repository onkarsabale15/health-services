import { ParameterProps } from '../fhir-mapper.types';
import { CodeableConcept } from './CodeableConcept';

export class ParameterItem {
  name?: string;
  valueString?: string;
  valueCodeableConcept?: CodeableConcept;

  constructor(props: ParameterProps = {}) {
    this.name = props.name;
    this.valueString = props.valueString;
    this.valueCodeableConcept = props.valueCodeableConcept;
  }
}
