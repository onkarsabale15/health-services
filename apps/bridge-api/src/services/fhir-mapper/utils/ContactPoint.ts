import { ContactPointSystem, ContactPointUse, ContactPointProps } from '../fhir-mapper.types';

const ALLOWED_CONTACT_POINT_USE: ContactPointUse[] = ['home', 'work', 'temp', 'old', 'mobile'];
const ALLOWED_CONTACT_POINT_SYSTEM: ContactPointSystem[] = ['phone', 'fax', 'email', 'pager', 'url', 'sms', 'other'];

export class ContactPoint {
  system?: ContactPointSystem;
  value?: string;
  use?: ContactPointUse;

  constructor(contactPoint: ContactPointProps = {}) {
    if (contactPoint.use && !ALLOWED_CONTACT_POINT_USE.includes(contactPoint.use)) {
      throw new Error(`Invalid contact use: ${contactPoint.use}`);
    }
    if (contactPoint.system && !ALLOWED_CONTACT_POINT_SYSTEM.includes(contactPoint.system)) {
      throw new Error(`Invalid contact system: ${contactPoint.system}`);
    }
    this.system = contactPoint.system;
    this.value = contactPoint.value;
    this.use = contactPoint.use;
  }

  toJSON(): ContactPointProps {
    return {
      system: this.system,
      value: this.value,
      use: this.use,
    };
  }
}
