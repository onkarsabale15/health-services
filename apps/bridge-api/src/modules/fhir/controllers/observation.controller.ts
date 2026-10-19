import { Observation } from '@medplum/fhirtypes';
import { Controller, Get, Post, Body, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { getVendorService } from '../../../services/vendor-service.factory';
import { SiteConfig } from '../decorators/integration-config.decorator';
import type { SiteData } from '@hs/ehr-data-service';
import { IntegrationDataInterceptor } from '../interceptors/integration-data.interceptor';
import { FhirCacheInterceptor } from '../interceptors/fhir-cache.interceptor';
import {
  ObservationSearchParams,
  ObservationWriteDto,
  FhirBundleResponse,
  FhirResourceResponse,
  OperationOutcomeResponse,
} from '../dto';

@ApiTags('Observation')
@ApiBearerAuth()
@Controller('fhir/r4/v1/Observation')
@UseInterceptors(IntegrationDataInterceptor, FhirCacheInterceptor)
export class ObservationController {
  @Get()
  @ApiOperation({ summary: 'Search observations' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of resources', type: FhirBundleResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  @ApiResponse({ status: 500, description: 'Server error', type: OperationOutcomeResponse })
  async getAllObservations(@Query() query: ObservationSearchParams, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).searchObservation(siteData, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create observation' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 201, description: 'Created resource', type: FhirResourceResponse })
  @ApiResponse({ status: 400, description: 'Validation error', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async createObservation(@Body() body: ObservationWriteDto, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).createObservation!(siteData, body as Observation);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get observation by ID' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Resource', type: FhirResourceResponse })
  @ApiResponse({ status: 404, description: 'Not found', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async getObservationById(@Param('id') id: string, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).getObservationById(siteData, id);
  }
}
