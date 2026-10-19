import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { getVendorService } from '../../../services/vendor-service.factory';
import { SiteConfig } from '../decorators/integration-config.decorator';
import type { SiteData } from '@hs/ehr-data-service';
import { IntegrationDataInterceptor } from '../interceptors/integration-data.interceptor';
import { FhirCacheInterceptor } from '../interceptors/fhir-cache.interceptor';
import { LocationSearchParams, FhirBundleResponse, FhirResourceResponse, OperationOutcomeResponse } from '../dto';

@ApiTags('Location')
@ApiBearerAuth()
@Controller('fhir/r4/v1/Location')
@UseInterceptors(IntegrationDataInterceptor, FhirCacheInterceptor)
export class LocationController {
  @Get()
  @ApiOperation({ summary: 'Search locations' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of resources', type: FhirBundleResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  @ApiResponse({ status: 500, description: 'Server error', type: OperationOutcomeResponse })
  async getAllLocations(@Query() query: LocationSearchParams, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).searchLocation(siteData, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get location by ID' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Resource', type: FhirResourceResponse })
  @ApiResponse({ status: 404, description: 'Not found', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async getLocationById(@Param('id') id: string, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).getLocationById(siteData, id);
  }
}
