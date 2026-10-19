export const FHIR_ADDRESS = {
  use: {
    HOME: 'home',
    WORK: 'work',
    TEMP: 'temp',
    OLD: 'old',
  },
  type: {
    POSTAL: 'postal',
    PHYSICAL: 'physical',
    BOTH: 'both',
  },
} as const;

export const FHIR_NAME = {
  use: {
    USUAL: 'usual',
    OFFICIAL: 'official',
    TEMP: 'temp',
    NICK_NAME: 'nickname',
    ANONYMOUS: 'anonymous',
    OLD: 'old',
    MAIDEN: 'maiden',
  },
} as const;

export const FHIR_CONTACTPOINT = {
  system: {
    PHONE: 'phone',
  },
  use: {
    WORK: 'work',
  },
} as const;
