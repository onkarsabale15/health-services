import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { getVendorService } from '../../../services/vendor-service.factory';
import { SiteConfig } from '../decorators/integration-config.decorator';
import type { SiteData } from '@hs/ehr-data-service';
import { IntegrationDataInterceptor } from '../interceptors/integration-data.interceptor';
import { FhirCacheInterceptor } from '../interceptors/fhir-cache.interceptor';
import { PractitionerSearchParams, FhirBundleResponse, FhirResourceResponse, OperationOutcomeResponse } from '../dto';

@ApiTags('Practitioner')
@ApiBearerAuth()
@Controller('fhir/r4/v1/Practitioner')
@UseInterceptors(IntegrationDataInterceptor, FhirCacheInterceptor)
export class PractitionerController {
  @Get()
  @ApiOperation({ summary: 'Search practitioners' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of resources', type: FhirBundleResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  @ApiResponse({ status: 500, description: 'Server error', type: OperationOutcomeResponse })
  async getAllPractitioners(@Query() query: PractitionerSearchParams, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).searchPractitioner(siteData, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get practitioner by ID' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Resource', type: FhirResourceResponse })
  @ApiResponse({ status: 404, description: 'Not found', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async getPractitionerById(@Param('id') id: string, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).getPractitionerById(siteData, id);
  }
}
