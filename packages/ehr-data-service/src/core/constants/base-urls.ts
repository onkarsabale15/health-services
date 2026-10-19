export const BASE_URLS: Record<string, Record<string, Record<string, string | null>>> = {
  practiceFusion: {
    system: {
      baseUrlTest: 'https://qa-api.practicefusion.com',
      baseUrlProd: null,
      authUrlTest: 'https://qa-api.practicefusion.com/fhir/r4/v1/{accountId}/token',
      authUrlProd: null,
    },
  },
  epic: {
    system: {
      baseUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth',
      baseUrlProd: null,
      authUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      authUrlProd: null,
    },
    provider: {
      baseUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth',
      baseUrlProd: 'https://fhir.epic.com/interconnect-fhir-oauth',
      authUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      authUrlProd: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      auth_code_test: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
      auth_code_prod: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    },
    patient: {
      baseUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth',
      baseUrlProd: 'https://fhir.epic.com/interconnect-fhir-oauth',
      authUrlTest: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      authUrlProd: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
      auth_code_test: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
      auth_code_prod: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    },
  },
  athenaNet: {
    system: {
      baseUrlTest: 'https://api.preview.platform.athenahealth.com',
      baseUrlProd: 'https://api.platform.athenahealth.com',
      authUrlProd: 'https://api.platform.athenahealth.com/oauth2/v1/token',
      authUrlTest: 'https://api.preview.platform.athenahealth.com/oauth2/v1/token',
    },
    provider: {
      baseUrlTest: 'https://api.preview.platform.athenahealth.com',
      baseUrlProd: 'https://api.platform.athenahealth.com',
      authUrlTest: 'https://myidentity-support.platform.athenahealth.com/oauth2/v1/token',
      authUrlProd: 'https://myidentity.platform.athenahealth.com/oauth2/v1/token',
      auth_code_test: 'https://myidentity-support.platform.athenahealth.com/oauth2/v1/authorize',
      auth_code_prod: 'https://myidentity.platform.athenahealth.com/oauth2/v1/authorize',
    },
    patient: {
      baseUrlTest: 'https://api.preview.platform.athenahealth.com',
      baseUrlProd: 'https://api.platform.athenahealth.com',
      authUrlTest: 'https://myidentity-support.platform.athenahealth.com/oauth2/v1/token',
      authUrlProd: 'https://myidentity.platform.athenahealth.com/oauth2/v1/token',
      auth_code_test: 'https://myidentity-support.platform.athenahealth.com/oauth2/v1/authorize',
      auth_code_prod: 'https://myidentity.platform.athenahealth.com/oauth2/v1/authorize',
    },
  },
  cerner: {
    provider: {
      baseUrlTest: 'https://fhir-ehr-code.cerner.com/r4/{tenant}',
      baseUrlProd: 'https://fhir-ehr-code.cerner.com/r4/{tenant}',
      authUrlTest: 'https://authorization.sandboxcerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
      authUrlProd: 'https://authorization.cerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
      auth_code_test:
        'https://authorization.sandboxcerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/personas/provider/authorize',
      auth_code_prod:
        'https://authorization.cerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/personas/provider/authorize',
    },
    patient: {
      baseUrlTest: 'https://fhir-ehr.sandboxcerner.com/r4/{tenant}',
      baseUrlProd: 'https://fhir-ehr.cerner.com/r4/{tenant}',
      authUrlTest: 'https://authorization.sandboxcerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
      authUrlProd: 'https://authorization.cerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
      auth_code_test:
        'https://authorization.sandboxcerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
      auth_code_prod:
        'https://authorization.cerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
    },
    system: {
      baseUrlTest: 'https://fhir-ehr.sandboxcerner.com/r4/{tenant}',
      baseUrlProd: 'https://fhir-ehr.cerner.com/r4/{tenant}',
      authUrlTest: 'https://authorization.sandboxcerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
      authUrlProd: 'https://authorization.cerner.com/tenants/{tenant}/protocols/oauth2/profiles/smart-v1/token',
    },
  },
  nextgen: {
    system: {
      baseUrlTest: 'https://nativeapi.nextgen.com',
      baseUrlProd: 'https://nativeapi.nextgen.com',
      authUrlProd: 'https://nativeapi.nextgen.com/nge/prod/nge-oauth/token',
      authUrlTest: 'https://nativeapi.nextgen.com/nge/prod/nge-oauth/token',
      fhirBaseUrlTest: 'https://fhir.nextgen.com/nge/prod/fhir-api-r4/fhir/R4',
    },
    provider: {
      baseUrlTest: 'https://nativeapi.nextgen.com',
      baseUrlProd: 'https://nativeapi.nextgen.com',
      authUrlTest: 'https://nativeapi.nextgen.com/nge/prod/nge-oauth/token',
      authUrlProd: 'https://nativeapi.nextgen.com/nge/prod/nge-oauth/token',
      auth_code_test: 'https://nativeapi.nextgen.com/nge/prod/nge-oauth/authorize',
      auth_code_prod: 'https://nativeapi.nextgen.com/nge/prod/nge-oauth/authorize',
      fhirBaseUrlTest: 'https://fhir.nextgen.com/nge/prod/fhir-api-r4/fhir/R4',
    },
    patient: {
      baseUrlTest: 'https://nativeapi.nextgen.com/nge/prod/nge-api/api',
      baseUrlProd: 'https://nativeapi.nextgen.com/nge/prod/nge-api/api',
      authUrlTest: 'https://nativeapi.nextgen.com/nge/prod/patient-oauth/token',
      authUrlProd: 'https://nativeapi.nextgen.com/nge/prod/patient-oauth/token',
      auth_code_test: 'https://nativeapi.nextgen.com/nge/prod/patient-oauth/authorize',
      auth_code_prod: 'https://nativeapi.nextgen.com/nge/prod/patient-oauth/authorize',
    },
  },
  veradigmEHR: {
    system: {
      baseUrlTest: 'https://ubiquityunity.azurewebsites.net/UnityService.svc/json/MagicJson',
      baseUrlProd: 'https://unity.allscriptscloud.com/unityservice.svc/json/MagicJson',
      authUrlTest: 'https://ubiquityunity.azurewebsites.net/UnityService.svc/json/GetToken',
      authUrlProd: 'https://unity.allscriptscloud.com/unityservice.svc/json/GetToken',
      expiryUrlTest: 'https://ubiquityunity.azurewebsites.net/UnityService.svc/json/RetireToken',
      expiryUrlProd: 'https://unity.allscriptscloud.com/unityservice.svc/json/RetireToken',
    },
  },
  touchWorksEHR: {
    system: {
      baseUrlTest: 'https://ubiquityunity.azurewebsites.net/UnityService.svc/json/MagicJson',
      baseUrlProd: 'https://unity.allscriptscloud.com/unityservice.svc/json/MagicJson',
      authUrlTest: 'https://ubiquityunity.azurewebsites.net/UnityService.svc/json/GetToken',
      authUrlProd: 'https://unity.allscriptscloud.com/unityservice.svc/json/GetToken',
      expiryUrlTest: 'https://ubiquityunity.azurewebsites.net/UnityService.svc/json/RetireToken',
      expiryUrlProd: 'https://unity.allscriptscloud.com/unityservice.svc/json/RetireToken',
    },
  },
  elationEmr: {
    system: {
      baseUrlTest: 'https://sandbox.elationemr.com/api/2.0',
      baseUrlProd: null,
      authUrlTest: 'https://sandbox.elationemr.com/api/2.0/oauth2/token/',
      authUrlProd: null,
    },
    provider: {
      baseUrlTest: 'https://sandbox.elationemr.com/api/2.0',
      baseUrlProd: null,
      authUrlTest: 'https://sandbox.elationemr.com/api/2.0/oauth2/token/',
      authUrlProd: null,
      auth_code_test: 'https://sandbox.elationemr.com/api/2.0/oauth2/authorize/',
      auth_code_prod: null,
    },
  },
  eClinicalWorks: {
    provider: {
      baseUrlTest: 'https://staging-fhir.ecwcloud.com/fhir/r4/{tenant}',
      baseUrlProd: null,
      authUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/authorize',
      authUrlProd: null,
      tokenUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/token',
      tokenUrlProd: null,
    },
    patient: {
      baseUrlTest: 'https://staging-fhir.ecwcloud.com/fhir/r4/{tenant}',
      baseUrlProd: null,
      authUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/authorize',
      authUrlProd: null,
      tokenUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/token',
      tokenUrlProd: null,
    },
    system: {
      baseUrlTest: 'https://staging-fhir.ecwcloud.com/fhir/r4/{tenant}',
      baseUrlProd: null,
      tokenUrlTest: 'https://staging-oauthserver.ecwcloud.com/oauth/oauth2/token',
    },
  },
  drChrono: {
    provider: {
      baseUrlTest: 'https://app.drchrono.com',
      baseUrlProd: null,
      authUrlTest: 'https://drchrono.com/o/authorize',
      authUrlProd: null,
      tokenUrlTest: 'https://drchrono.com/o/token/',
      tokenUrlProd: null,
    },
    patient: {
      baseUrlTest: 'https://app.drchrono.com',
      baseUrlProd: null,
      authUrlTest: 'https://drchrono.com/o/authorize',
      authUrlProd: null,
      tokenUrlTest: 'https://drchrono.com/o/token/',
      tokenUrlProd: null,
    },
  },
  meditech: {
    provider: {
      baseUrlTest: 'https://greenfield-prod-apis.meditech.com',
      baseUrlProd: null,
      authUrlTest: 'https://greenfield-prod-apis.meditech.com/oauth/token',
      authUrlProd: null,
    },
    patient: {
      baseUrlTest: 'https://greenfield-prod-apis.meditech.com',
      baseUrlProd: null,
      authUrlTest: 'https://greenfield-prod-apis.meditech.com/oauth/token',
      authUrlProd: null,
    },
  },
  medent: {
    system: {
      baseUrlTest: 'https://www.medentfhir.com/fhir/R4',
      baseUrlProd: 'https://www.medentfhir.com/fhir/R4',
    },
  },
  greenways: {
    system: {
      baseUrlTest: 'https://fhir-api.fhirprod.aws.greenwayhealth.com',
      baseUrlProd: 'https://fhir-api.fhirprod.aws.greenwayhealth.com',
    },
  },
} as const;
