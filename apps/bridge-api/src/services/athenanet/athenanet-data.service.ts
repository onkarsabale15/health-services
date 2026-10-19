import { athena, toEhrConfig, type EhrClientConfig, type AthenaPatientResponse } from '@hs/ehr-data-service';
import type { SiteData } from '@hs/ehr-data-service';
import { logger } from '@hs/observability';
import type {
  Bundle,
  Patient,
  Appointment,
  Encounter,
  Coverage,
  Condition,
  Practitioner,
  AllergyIntolerance,
  ServiceRequest,
  Communication,
  Observation,
  DocumentReference,
  Location,
} from '@medplum/fhirtypes';
import type { IVendorDataService, FhirSearchParams, WriteOptions } from '../vendor-data-service.interface';
import {
  mapperUtils,
  patientLookup,
  appointmentLookup,
  encounterLookup,
  allergySearch,
  fhirMappings,
  buildPractitionerName,
  conditionDataExtraction,
  documentMappings,
  typeCodeToIdMap,
} from './athenanet.mapper';

// ---------------------------------------------------------------------------
// AthenaDataService — bridge service layer for AthenaNet
//
// Maps FHIR search params to AthenaNet proprietary/FHIR formats, delegates
// raw API calls to `athena` from @hs/ehr-data-service, and transforms
// responses back to FHIR R4 format via AthenaNetUtils.
// ---------------------------------------------------------------------------

class AthenaDataService implements IVendorDataService {
  // =========================================================================
  // Patient
  // =========================================================================

  async searchPatient(siteData: SiteData, params: FhirSearchParams): Promise<Bundle<Patient>> {
    const config = toEhrConfig(siteData);
    const response = await athena.fhirPatientSearch(config, params);
    return response.data as Bundle<Patient>;
  }

  async getPatientById(siteData: SiteData, id: string, _query?: Record<string, any>): Promise<Patient> {
    const config = toEhrConfig(siteData);
    const response = await athena.getPatientByFhirId(config, id);
    return response.data as Patient;
  }

  async createPatient(siteData: SiteData, body: Patient): Promise<any> {
    const config = toEhrConfig(siteData);
    const requestBody = mapperUtils.convertFhirToRequestBody(body);
    const response = await athena.createPatient(config, new URLSearchParams(requestBody).toString());
    return response.data;
  }

  // =========================================================================
  // Appointment
  // =========================================================================

  async searchAppointment(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    const config = toEhrConfig(siteData);
    const athenaParams = appointmentLookup(params);

    // Route: by departmentid, by appointmentid, or practice-wide (multi-department)
    if (athenaParams.departmentid) {
      return this.departmentAppointments(athenaParams, config, params.patient as string);
    }
    if (athenaParams.appointmentid) {
      return this.appointmentByIdSearch(athenaParams, config, params.patient as string);
    }
    return this.practiceAppointments(athenaParams, config, params.patient as string);
  }

  private async departmentAppointments(
    params: Record<string, any>,
    config: EhrClientConfig,
    patient: string,
  ): Promise<any> {
    const response = await athena.getBookedAppointments(config, params);
    return mapperUtils.convertAppointmentEhrToFhir((response.data as any)?.appointments ?? [], patient, true);
  }

  private async practiceAppointments(
    params: Record<string, any>,
    config: EhrClientConfig,
    patient: string,
  ): Promise<any> {
    const response = await athena.getMultiDeptAppointments(config, params);
    return mapperUtils.convertAppointmentEhrToFhir((response.data as any)?.appointments ?? [], patient, true);
  }

  private async appointmentByIdSearch(
    params: Record<string, any>,
    config: EhrClientConfig,
    patient: string,
  ): Promise<any> {
    const response = await athena.getAppointmentById(config, params.appointmentid as string);
    return mapperUtils.convertAppointmentEhrToFhir((response.data as any) ?? [], patient, true);
  }

  async getAppointmentById(siteData: SiteData, id: string): Promise<Appointment> {
    const config = toEhrConfig(siteData);
    const response = await athena.getAppointmentById(config, id);
    return mapperUtils.convertAppointmentEhrToFhir(response.data as any, null, false) as Promise<Appointment>;
  }

  // =========================================================================
  // Encounter
  // =========================================================================

  async searchEncounter(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    const config = toEhrConfig(siteData);
    const patientId = params?.patient as string;

    const athenaParams = encounterLookup(params);
    const response = await athena.getPatientEncounters(config, patientId, athenaParams);
    return mapperUtils.convertEncountersEhrToFhir(
      (response.data as any)?.encounters ?? [],
      patientId,
      siteData.accountId as string,
      true,
    );
  }

  async getEncounterById(siteData: SiteData, id: string): Promise<Encounter> {
    const config = toEhrConfig(siteData);
    const response = await athena.getEncounterById(config, id);
    return mapperUtils.convertEncountersEhrToFhir(
      response.data as any,
      null,
      siteData.accountId as string,
      false,
    ) as Promise<Encounter>;
  }

  async updateEncounter(siteData: SiteData, id: string, body: Encounter, _options?: WriteOptions): Promise<any> {
    // athenahealth doesn't enforce optimistic concurrency on this endpoint, so
    // ifMatch is intentionally ignored — kept for IVendorDataService parity.
    const config = toEhrConfig(siteData);
    const ehrBody = await mapperUtils.convertEncounterDiagnosesFhirToEhr(body);
    const diagnosisId = (body?.id?.split('-')?.pop() as string) || (body?.id as string);
    const response = await athena.updateEncounterDiagnosis(config, id, diagnosisId, ehrBody);
    return response.data;
  }

  // =========================================================================
  // Coverage
  // =========================================================================

  async searchCoverage(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    const config = toEhrConfig(siteData);
    const patientId = params?.patient as string;
    const response = await athena.getPatientInsurances(config, patientId);
    return mapperUtils.convertCoverageEhrToFhir((response.data as any)?.insurances ?? [], patientId, true);
  }

  async getCoverageById(siteData: SiteData, id: string): Promise<any> {
    // AthenaNet does not support direct coverage lookup by ID
    logger.warn('AthenaNet getCoverageById: not supported', { id });
    return {
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'not-supported',
          details: { text: 'AthenaNet does not support Coverage read by ID' },
        },
      ],
    };
  }

  async createCoverage(siteData: SiteData, body: Coverage): Promise<any> {
    const config = toEhrConfig(siteData);
    const patientId = body?.beneficiary?.reference?.split('/')?.pop() as string;
    const ehrBody = await mapperUtils.convertCoverageFhirToEhr(body);
    const response = await athena.createPatientInsurance(config, patientId, new URLSearchParams(ehrBody).toString());
    return response.data;
  }

  // =========================================================================
  // Condition
  //
  // AthenaNet has two condition sources:
  //  1. FHIR Condition (encounter-diagnosis) — via athena.searchConditions
  //  2. Proprietary chart problems (problem-list-item) — via athena.getChartProblems
  // Category param routes to one, both, or specific source.
  // =========================================================================

  async searchCondition(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    const config = toEhrConfig(siteData);
    const category = params?.category;
    const patientId = params?.patient as string;

    if (category === 'encounter-diagnosis') {
      const ehrParams = allergySearch(params, siteData);
      const response = await athena.searchConditions(config, ehrParams);
      return mapperUtils.convertFhirToIb(response.data as any, siteData);
    }

    if (category === 'problem-list-item') {
      return this.getChartProblems(patientId, config);
    }

    // No category — fetch both encounter diagnoses and problems in parallel
    const ehrParams = allergySearch(params, siteData);
    const [fhirConditions, problems] = await Promise.all([
      athena.searchConditions(config, ehrParams),
      athena.getChartProblems(config, patientId),
    ]);

    const conditionBundle = await mapperUtils.convertFhirToIb(fhirConditions.data as any, siteData);
    const problemBundle = await mapperUtils.convertProblemToFhirCondition(problems.data as any, patientId);

    // Merge both bundles
    conditionBundle.entry = [...(conditionBundle.entry ?? []), ...(problemBundle.entry ?? [])];
    conditionBundle.total = conditionBundle.entry.length;
    return conditionBundle;
  }

  async getConditionById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const fhirId = `a-${siteData.accountId}.E-${id}`;
    const response = await athena.getConditionByFhirId(config, fhirId);
    const data = response.data as Condition;
    if (data) mapperUtils.filterResource(data);
    return data;
  }

  async createCondition(siteData: SiteData, body: Condition): Promise<any> {
    const config = toEhrConfig(siteData);
    return this.createUniqueConditions(body, config, siteData);
  }

  async updateCondition(siteData: SiteData, id: string, body: Condition, _options?: WriteOptions): Promise<any> {
    // athenahealth doesn't enforce optimistic concurrency on this endpoint, so
    // ifMatch is intentionally ignored — kept for IVendorDataService parity.
    const config = toEhrConfig(siteData);
    const category = body?.category?.[0]?.coding?.[0]?.code;

    if (category === 'problem-list-item') {
      return this.updateProblemCondition(body, config);
    }
    return this.updateEncounterDiagnosisCondition(body, config);
  }

  private async getChartProblems(patientId: string, config: EhrClientConfig): Promise<any> {
    const response = await athena.getChartProblems(config, patientId);
    return mapperUtils.convertProblemToFhirCondition(response.data as any, patientId);
  }

  /** Check if a condition already exists (encounter-diagnosis + problem) before creating duplicates. */
  private async checkExistingConditions(body: Condition, config: EhrClientConfig, siteData: SiteData): Promise<any> {
    const patientId = body?.subject?.reference?.split('/')?.pop() as string;
    const encounterId = body?.encounter?.reference?.split('/')?.pop() as string;
    const snomedCode = body?.code?.coding?.find((c) => c.system?.includes('snomed'))?.code as string;

    const ehrParams = allergySearch({ patient: patientId }, siteData);
    const response = await athena.searchConditions(config, ehrParams);
    return mapperUtils.checkExistingConditions(response.data as any, snomedCode, encounterId);
  }

  /**
   * Create both an encounter diagnosis and a problem for the given condition,
   * but only if they don't already exist (deduplication).
   */
  private async createUniqueConditions(body: Condition, config: EhrClientConfig, siteData: SiteData): Promise<any> {
    const check = await this.checkExistingConditions(body, config, siteData);
    const responses: any[] = [];

    if (!check.encounterDiagnosisExists) {
      try {
        const extracted = await conditionDataExtraction(body);
        const dxResponse = await athena.createEncounterDiagnosis(
          config,
          extracted.encounter!,
          extracted.data.toString(),
        );
        responses.push(dxResponse);
      } catch (error: any) {
        logger.error('Failed to create encounter diagnosis', error);
      }
    }

    if (!check.problemExists) {
      try {
        const patientId = body?.subject?.reference?.split('/')?.pop() as string;
        const ehrBody = await mapperUtils.convertEncounterDiagnosesFhirToEhr(body as any, true);
        const problemResponse = await athena.createProblem(config, patientId, ehrBody);
        responses.push(problemResponse);
      } catch (error: any) {
        logger.error('Failed to create problem', error);
      }
    }

    return mapperUtils.generateConditionResponse(responses, check);
  }

  private async updateProblemCondition(body: Condition, config: EhrClientConfig): Promise<any> {
    const patientId = body?.subject?.reference?.split('/')?.pop() as string;
    const problemId = body?.id as string;
    const ehrBody = await mapperUtils.convertEncounterDiagnosesFhirToEhr(body as any, true);
    const response = await athena.updateProblem(config, patientId, problemId, ehrBody);
    return response.data;
  }

  private async updateEncounterDiagnosisCondition(body: Condition, config: EhrClientConfig): Promise<any> {
    const encounterId = body?.encounter?.reference?.split('/')?.pop() as string;
    const diagnosisId = body?.id as string;
    const ehrBody = await mapperUtils.convertEncounterDiagnosesFhirToEhr(body as any);
    const response = await athena.updateEncounterDiagnosis(config, encounterId, diagnosisId, ehrBody);
    return response.data;
  }

  // =========================================================================
  // Practitioner
  // =========================================================================

  async searchPractitioner(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    const config = toEhrConfig(siteData);

    // Identifier search routes to FHIR Practitioner endpoint
    if (params?.identifier) {
      return this.getPractitionerByIdentifier(params, config, siteData);
    }

    // Proprietary provider search with name
    const name = buildPractitionerName(params);
    const athenaParams: Record<string, any> = {};
    if (name) athenaParams.name = name;
    if (params?._count) athenaParams.limit = params._count;
    if (params?._getpagesoffset) athenaParams.offset = params._getpagesoffset;

    const response = await athena.searchProviders(config, athenaParams);
    return mapperUtils.convetPractitionerEhrToFhir(
      (response.data as any)?.providers ?? [],
      siteData.accountId as string,
      true,
    );
  }

  async getPractitionerById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const fhirId = `a-${siteData.accountId}.Provider-${id}`;
    try {
      const response = await athena.getPractitionerByFhirId(config, fhirId);
      const data = response.data as Practitioner;
      if (data) mapperUtils.filterResource(data);
      return data;
    } catch {
      // Fallback to proprietary search by provider ID
      const response = await athena.searchProviders(config, { providerid: id });
      return mapperUtils.convetPractitionerEhrToFhir(
        (response.data as any)?.providers?.[0] as any,
        siteData.accountId as string,
        false,
      );
    }
  }

  private async getPractitionerByIdentifier(
    params: Record<string, any>,
    config: EhrClientConfig,
    siteData: SiteData,
  ): Promise<any> {
    const fhirParams = fhirMappings(params, siteData);
    fhirParams.identifier = params.identifier as string;
    if (params?._count) fhirParams._count = params._count as number;
    const response = await athena.searchPractitioners(config, fhirParams);
    return mapperUtils.convertFhirPatientToEhr(response.data as any, siteData);
  }

  // =========================================================================
  // AllergyIntolerance
  // =========================================================================

  async searchAllergy(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    const config = toEhrConfig(siteData);
    const ehrParams = allergySearch(params, siteData);
    const response = await athena.searchAllergies(config, ehrParams);
    return mapperUtils.convertFhirToIb(response.data as any, siteData);
  }

  async getAllergyById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const fhirId = `a-${siteData.accountId}.E-${id}`;
    const response = await athena.getAllergyByFhirId(config, fhirId);
    const data = response.data as AllergyIntolerance;
    if (data) mapperUtils.filterResource(data);
    return data;
  }

  async createAllergy(siteData: SiteData, body: AllergyIntolerance): Promise<any> {
    const config = toEhrConfig(siteData);
    const patientId = body?.patient?.reference?.split('/')?.pop() as string;
    const ehrBody = await mapperUtils.converAllergyFhirToEhr(body);
    const response = await athena.putChartAllergy(config, patientId, ehrBody);
    return response.data;
  }

  // =========================================================================
  // ServiceRequest
  // =========================================================================

  async searchServiceRequest(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    const config = toEhrConfig(siteData);
    const ehrParams = allergySearch(params, siteData);
    const response = await athena.searchServiceRequests(config, ehrParams);
    return mapperUtils.convertFhirToIb(response.data as any, siteData);
  }

  async getServiceRequestById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const fhirId = `a-${siteData.accountId}.E-${id}`;
    const response = await athena.getServiceRequestByFhirId(config, fhirId);
    const data = response.data as ServiceRequest;
    if (data) mapperUtils.filterResource(data);
    return data;
  }

  // =========================================================================
  // MedicationStatement — not supported by AthenaNet
  // =========================================================================

  async searchMedicationStatement(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    logger.warn('AthenaNet searchMedicationStatement: not supported', { params });
    return { resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] };
  }

  async getMedicationStatementById(siteData: SiteData, id: string): Promise<any> {
    logger.warn('AthenaNet getMedicationStatementById: not supported', { id });
    return {
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'not-supported',
          details: { text: 'AthenaNet does not support MedicationStatement' },
        },
      ],
    };
  }

  // =========================================================================
  // Communication (maps to AthenaNet Chart Alert)
  // =========================================================================

  async searchCommunication(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    const config = toEhrConfig(siteData);
    const patientId = params?.patient as string;
    const response = await athena.getChartAlerts(config, patientId, params as any);
    return response.data;
  }

  async getCommunicationById(siteData: SiteData, id: string): Promise<any> {
    // AthenaNet chart alerts do not support direct ID lookup
    logger.warn('AthenaNet getCommunicationById: not supported', { id });
    return {
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'not-supported',
          details: { text: 'AthenaNet does not support Communication read by ID' },
        },
      ],
    };
  }

  async createCommunication(siteData: SiteData, body: Communication): Promise<any> {
    const config = toEhrConfig(siteData);
    const patientId = body?.subject?.reference?.split('/')?.pop() as string;
    const ehrBody = await mapperUtils.createCommunicationBody(body, siteData);
    const response = await athena.createChartAlert(config, patientId, new URLSearchParams(ehrBody as any).toString());
    return response.data;
  }

  // =========================================================================
  // Observation
  // =========================================================================

  async searchObservation(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    const config = toEhrConfig(siteData);
    const ehrParams = allergySearch(params, siteData);
    const response = await athena.searchObservations(config, ehrParams);
    return mapperUtils.convertFhirToIb(response.data as any, siteData);
  }

  async getObservationById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const fhirId = `a-${siteData.accountId}.E-${id}`;
    const response = await athena.getObservationByFhirId(config, fhirId);
    const data = response.data as Observation;
    if (data) mapperUtils.filterResource(data);
    return data;
  }

  // =========================================================================
  // DocumentReference
  // =========================================================================

  async searchDocumentReference(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    const config = toEhrConfig(siteData);

    // CCDA export route when a known document type is requested
    if (params?.type && documentMappings[params.type as string]) {
      return this.getCCDA(params, config);
    }

    const ehrParams = allergySearch(params, siteData);
    const response = await athena.searchDocumentReferences(config, ehrParams);
    return mapperUtils.convertFhirToIb(response.data as any, siteData);
  }

  async getDocumentReferenceById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const fhirId = `a-${siteData.accountId}.E-${id}`;
    const response = await athena.getDocumentReferenceByFhirId(config, fhirId);
    const data = response.data as DocumentReference;
    if (data) mapperUtils.filterResource(data);
    return data;
  }

  async createDocumentReference(siteData: SiteData, body: DocumentReference): Promise<any> {
    const config = toEhrConfig(siteData);
    const typeCode = body?.type?.coding?.[0]?.code as string;

    // Note-type documents (HPI, progress notes) route to specific endpoints
    if (typeCodeToIdMap[typeCode]) {
      return this.createDocumentNote(body, config, typeCode);
    }

    // Standard encounter document
    return this.createEncounterDoc(body, config);
  }

  private async createDocumentNote(body: DocumentReference, config: EhrClientConfig, typeCode: string): Promise<any> {
    const { body: formBody, encounter } = await mapperUtils.convertDocumentRefToNote(body);

    if (!encounter) {
      throw new Error('Encounter reference is required for note-type documents');
    }

    // HPI note (LOINC 10164-2)
    if (typeCode === '10164-2') {
      const response = await athena.putEncounterHpi(config, encounter, formBody.toString());
      return this.buildDocRefCreatedResponse(body, response);
    }

    // Progress note / procedure note — use assessment endpoint
    const response = await athena.putEncounterAssessment(config, encounter, formBody.toString());
    return this.buildDocRefCreatedResponse(body, response);
  }

  private async createEncounterDoc(body: DocumentReference, config: EhrClientConfig): Promise<any> {
    const patientId = body?.subject?.reference?.split('/')?.pop() as string;
    const ehrBody = await mapperUtils.convertDocumentReferenceFhirToEhr(body);
    const response = await athena.createEncounterDocument(config, patientId, new URLSearchParams(ehrBody).toString());
    return this.buildDocRefCreatedResponse(body, response);
  }

  private buildDocRefCreatedResponse(originalBody: DocumentReference, response: any): any {
    return {
      resourceType: 'DocumentReference',
      status: 'current',
      type: originalBody?.type,
      subject: originalBody?.subject,
      content: originalBody?.content,
      response: response.data,
    };
  }

  private async getCCDA(params: Record<string, any>, config: EhrClientConfig): Promise<any> {
    const patientId = params?.patient;
    const ccdaType = documentMappings[params.type];
    const ccdaParams: Record<string, any> = { patientid: patientId };
    if (ccdaType) ccdaParams.doctype = ccdaType;

    const response = await athena.getCcdaExport(config, patientId, ccdaParams);
    return response.data;
  }

  // =========================================================================
  // Location (maps to AthenaNet Department)
  // =========================================================================

  async searchLocation(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await athena.getDepartments(config, params as any);
    return mapperUtils.convertDepartmentToLocation((response.data as any)?.departments ?? []);
  }

  async getLocationById(siteData: SiteData, id: string): Promise<any> {
    const config = toEhrConfig(siteData);
    const response = await athena.getDepartments(config, { departmentid: id });
    const departments = (response.data as any)?.departments ?? [];
    if (departments.length === 0) {
      return {
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'not-found', details: { text: `Location/${id} not found` } }],
      };
    }
    const bundle = await mapperUtils.convertDepartmentToLocation(departments);
    return bundle.entry?.[0]?.resource;
  }

  // =========================================================================
  // Task — not supported by AthenaNet
  // =========================================================================

  async searchTask(siteData: SiteData, params: Record<string, string | number | boolean>): Promise<any> {
    logger.warn('AthenaNet searchTask: not supported', { params });
    return { resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] };
  }

  async getTaskById(siteData: SiteData, id: string): Promise<any> {
    logger.warn('AthenaNet getTaskById: not supported', { id });
    return {
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'not-supported', details: { text: 'AthenaNet does not support Task' } }],
    };
  }
}

export const athenaDataService = new AthenaDataService();
