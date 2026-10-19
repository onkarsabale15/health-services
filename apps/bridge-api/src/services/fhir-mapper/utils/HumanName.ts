import { NameUse, HumanNameProps } from '../fhir-mapper.types';

const ALLOWED_NAME_USE: NameUse[] = ['usual', 'official', 'temp', 'nickname', 'anonymous', 'old', 'maiden'];

export class HumanName {
  use?: NameUse;
  text?: string;
  family?: string;
  given: string[];
  prefix: string[];
  suffix: string[];

  constructor(name: HumanNameProps = {}) {
    if (name.use && !ALLOWED_NAME_USE.includes(name.use)) {
      throw new Error(`Invalid name use: ${name.use}`);
    }
    this.use = name.use;
    this.text = name.text;
    this.family = name.family;
    this.given = name.given || [];
    this.prefix = name.prefix || [];
    this.suffix = name.suffix || [];
  }

  toJSON(): HumanNameProps {
    return {
      use: this.use,
      text: this.text,
      family: this.family,
      given: this.given,
      prefix: this.prefix,
      suffix: this.suffix,
    };
  }
}
