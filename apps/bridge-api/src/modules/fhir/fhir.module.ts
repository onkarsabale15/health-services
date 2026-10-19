import { Module } from '@nestjs/common';
import { MetadataController } from './controllers/metadata.controller';
import { PatientController } from './controllers/patient.controller';
import { AppointmentController } from './controllers/appointment.controller';
import { EncounterController } from './controllers/encounter.controller';
import { CoverageController } from './controllers/coverage.controller';
import { ConditionController } from './controllers/condition.controller';
import { PractitionerController } from './controllers/practitioner.controller';
import { AllergyIntoleranceController } from './controllers/allergy-intolerance.controller';
import { ServiceRequestController } from './controllers/service-request.controller';
import { MedicationStatementController } from './controllers/medication-statement.controller';
import { MedicationRequestController } from './controllers/medication-request.controller';
import { CommunicationController } from './controllers/communication.controller';
import { ObservationController } from './controllers/observation.controller';
import { DocumentReferenceController } from './controllers/document-reference.controller';
import { LocationController } from './controllers/location.controller';
import { TaskController } from './controllers/task.controller';

@Module({
  controllers: [
    MetadataController,
    PatientController,
    AppointmentController,
    EncounterController,
    CoverageController,
    ConditionController,
    PractitionerController,
    AllergyIntoleranceController,
    ServiceRequestController,
    MedicationStatementController,
    MedicationRequestController,
    CommunicationController,
    ObservationController,
    DocumentReferenceController,
    LocationController,
    TaskController,
  ],
})
export class FhirModule {}
