import { Encounter } from '@medplum/fhirtypes';
import { Controller, Get, Post, Put, Param, Query, Body, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { getVendorService } from '../../../services/vendor-service.factory';
import { SiteConfig } from '../decorators/integration-config.decorator';
import { IfMatch } from '../decorators/if-match.decorator';
import type { SiteData } from '@hs/ehr-data-service';
import { IntegrationDataInterceptor } from '../interceptors/integration-data.interceptor';
import { FhirCacheInterceptor } from '../interceptors/fhir-cache.interceptor';
import {
  EncounterSearchParams,
  EncounterWriteDto,
  FhirBundleResponse,
  FhirResourceResponse,
  OperationOutcomeResponse,
} from '../dto';

@ApiTags('Encounter')
@ApiBearerAuth()
@Controller('fhir/r4/v1/Encounter')
@UseInterceptors(IntegrationDataInterceptor, FhirCacheInterceptor)
export class EncounterController {
  @Get()
  @ApiOperation({ summary: 'Search encounters' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of resources', type: FhirBundleResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  @ApiResponse({ status: 500, description: 'Server error', type: OperationOutcomeResponse })
  async getAllEncounters(@Query() query: EncounterSearchParams, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).searchEncounter(siteData, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get encounter by ID' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Resource', type: FhirResourceResponse })
  @ApiResponse({ status: 404, description: 'Not found', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async getEncounterById(@Param('id') id: string, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).getEncounterById(siteData, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create encounter' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 201, description: 'Created resource', type: FhirResourceResponse })
  @ApiResponse({ status: 400, description: 'Validation error', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async createEncounter(@Body() body: EncounterWriteDto, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).createEncounter!(siteData, body as Encounter);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update encounter' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'Updated resource', type: FhirResourceResponse })
  @ApiResponse({ status: 400, description: 'Validation error', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async updateEncounter(
    @Param('id') id: string,
    @Body() body: EncounterWriteDto,
    @SiteConfig() siteData: SiteData,
    @IfMatch() ifMatch?: string,
  ) {
    return getVendorService(siteData.ehrName).updateEncounter!(siteData, id, body as Encounter, { ifMatch });
  }
}
