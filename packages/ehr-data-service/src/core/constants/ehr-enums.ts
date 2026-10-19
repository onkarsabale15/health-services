export const EHR = Object.freeze({
  TW: 'touchWorksEHR',
  VEHR: 'veradigmEHR',
  athena: 'athenaNet',
  PF: 'practiceFusion',
  EPIC: 'epic',
  NEXT_GEN: 'nextgen',
  ECW: 'eClinicalWorks',
  ELATION: 'elationEmr',
  MEDITECH: 'meditech',
  DR_CHRONO: 'drChrono',
  CERNER: 'cerner',
  SMART_HEALTH: 'smartHealth',
} as const);

export const EHR_URL_PARTS = Object.freeze({
  TW: 'touchWorksEHR',
  VEHR: 'veradigmEHR',
  athena: 'athenaNet',
  PF: 'practiceFusion',
  EPIC: 'epic',
  NEXT_GEN: 'nextgen',
  ECW: 'eCW',
  ELATION: 'elationEmr',
  MEDITECH: 'meditech',
  DR_CHRONO: 'drChrono',
  CERNER: 'cerner',
  SMART_HEALTH: 'smartHealth',
} as const);

export type EhrName = (typeof EHR)[keyof typeof EHR];
