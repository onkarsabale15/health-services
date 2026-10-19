import { AddressUse, AddressType } from '../fhir-mapper.types';

export interface AddressData {
  use?: AddressUse;
  value?: string;
  country?: string;
}

export class Address {
  use?: AddressUse;
  value?: string;
  country?: string;

  constructor({ use, value, country }: AddressData = {}) {
    this.use = use;
    this.value = value;
    this.country = country;
  }

  toJSON(): AddressData {
    return {
      use: this.use,
      value: this.value,
      country: this.country,
    };
  }
}
