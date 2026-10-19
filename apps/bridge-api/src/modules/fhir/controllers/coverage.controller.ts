import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { getVendorService } from '../../../services/vendor-service.factory';
import { SiteConfig } from '../decorators/integration-config.decorator';
import type { SiteData } from '@hs/ehr-data-service';
import { IntegrationDataInterceptor } from '../interceptors/integration-data.interceptor';
import { FhirCacheInterceptor } from '../interceptors/fhir-cache.interceptor';
import { CoverageSearchParams, FhirBundleResponse, FhirResourceResponse, OperationOutcomeResponse } from '../dto';

@ApiTags('Coverage')
@ApiBearerAuth()
@Controller('fhir/r4/v1/Coverage')
@UseInterceptors(IntegrationDataInterceptor, FhirCacheInterceptor)
export class CoverageController {
  @Get()
  @ApiOperation({ summary: 'Search coverages' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of resources', type: FhirBundleResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  @ApiResponse({ status: 500, description: 'Server error', type: OperationOutcomeResponse })
  async getAllCoverages(@Query() query: CoverageSearchParams, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).searchCoverage(siteData, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get coverage by ID' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Resource', type: FhirResourceResponse })
  @ApiResponse({ status: 404, description: 'Not found', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async getCoverageById(@Param('id') id: string, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).getCoverageById(siteData, id);
  }
}
