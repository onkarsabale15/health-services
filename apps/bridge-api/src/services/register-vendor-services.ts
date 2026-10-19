import { registerVendorDataService } from './vendor-service.factory';
import { epicDataService } from './epic/epic-data.service';
import { cernerDataService } from './cerner/cerner-data.service';
import { athenaDataService } from './athenanet/athenanet-data.service';
import { nextgenDataService } from './nextgen/nextgen-data.service';
import { ecwDataService } from './eclinicalworks/ecw-data.service';
import { drchronoDataService } from './drchrono/drchrono-data.service';
import { elationDataService } from './elation/elation-data.service';
import { meditechDataService } from './meditech/meditech-data.service';
import { medentDataService } from './medent/medent-data.service';
import { greenwaysDataService } from './greenways/greenways-data.service';

/**
 * Register all bridge vendor data services.
 * Called once at app startup after ehr-data-service is initialized.
 *
 * Each vendor data service handles FHIR ↔ vendor format mapping
 * and delegates raw API calls to @hs/ehr-data-service.
 */
export function registerVendorDataServices(): void {
  registerVendorDataService('epic', epicDataService);
  registerVendorDataService('cerner', cernerDataService);
  registerVendorDataService('athenanet', athenaDataService);
  registerVendorDataService('nextgen', nextgenDataService);
  registerVendorDataService('eclinicalworks', ecwDataService);
  registerVendorDataService('drchrono', drchronoDataService);
  registerVendorDataService('elation', elationDataService);
  registerVendorDataService('meditech', meditechDataService);
  registerVendorDataService('medent', medentDataService);
  registerVendorDataService('greenways', greenwaysDataService);
}
