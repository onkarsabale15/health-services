import { Controller, Get, Param, Query, UseInterceptors, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { getVendorService } from '../../../services/vendor-service.factory';
import { SiteConfig } from '../decorators/integration-config.decorator';
import type { SiteData } from '@hs/ehr-data-service';
import { IntegrationDataInterceptor } from '../interceptors/integration-data.interceptor';
import { FhirCacheInterceptor } from '../interceptors/fhir-cache.interceptor';
import {
  MedicationRequestSearchParams,
  FhirBundleResponse,
  FhirResourceResponse,
  OperationOutcomeResponse,
} from '../dto';

@ApiTags('MedicationRequest')
@ApiBearerAuth()
@Controller('fhir/r4/v1/MedicationRequest')
@UseInterceptors(IntegrationDataInterceptor, FhirCacheInterceptor)
export class MedicationRequestController {
  @Get()
  @ApiOperation({ summary: 'Search medication requests' })
  @ApiHeader({ name: 'X-Session-Id', required: false, description: 'SMART session ID' })
  @ApiHeader({ name: 'X-Site-Id', required: false, description: 'Site ID' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of MedicationRequest resources', type: FhirBundleResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async searchMedicationRequests(@Query() query: MedicationRequestSearchParams, @SiteConfig() siteData: SiteData) {
    const vendor = getVendorService(siteData.ehrName);
    if (!vendor.searchMedicationRequest) {
      throw new BadRequestException(`MedicationRequest search is not supported by ${siteData.ehrName}`);
    }
    return vendor.searchMedicationRequest(siteData, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medication request by ID' })
  @ApiHeader({ name: 'X-Session-Id', required: false, description: 'SMART session ID' })
  @ApiHeader({ name: 'X-Site-Id', required: false, description: 'Site ID' })
  @ApiResponse({ status: 200, description: 'FHIR MedicationRequest resource', type: FhirResourceResponse })
  @ApiResponse({ status: 404, description: 'Not found', type: OperationOutcomeResponse })
  async getMedicationRequestById(@Param('id') id: string, @SiteConfig() siteData: SiteData) {
    const vendor = getVendorService(siteData.ehrName);
    if (!vendor.getMedicationRequestById) {
      throw new BadRequestException(`MedicationRequest read is not supported by ${siteData.ehrName}`);
    }
    return vendor.getMedicationRequestById(siteData, id);
  }
}
