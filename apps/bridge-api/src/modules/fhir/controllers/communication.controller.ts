import { Communication } from '@medplum/fhirtypes';
import { Controller, Get, Post, Body, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { getVendorService } from '../../../services/vendor-service.factory';
import { SiteConfig } from '../decorators/integration-config.decorator';
import type { SiteData } from '@hs/ehr-data-service';
import { IntegrationDataInterceptor } from '../interceptors/integration-data.interceptor';
import { FhirCacheInterceptor } from '../interceptors/fhir-cache.interceptor';
import {
  CommunicationSearchParams,
  BaseFhirWriteDto,
  FhirBundleResponse,
  FhirResourceResponse,
  OperationOutcomeResponse,
} from '../dto';

@ApiTags('Communication')
@ApiBearerAuth()
@Controller('fhir/r4/v1/Communication')
@UseInterceptors(IntegrationDataInterceptor, FhirCacheInterceptor)
export class CommunicationController {
  @Get()
  @ApiOperation({ summary: 'Search communications' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of resources', type: FhirBundleResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  @ApiResponse({ status: 500, description: 'Server error', type: OperationOutcomeResponse })
  async getAllCommunications(@Query() query: CommunicationSearchParams, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).searchCommunication(siteData, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create communication' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 201, description: 'Created resource', type: FhirResourceResponse })
  @ApiResponse({ status: 400, description: 'Validation error', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async createCommunication(@Body() body: BaseFhirWriteDto, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).createCommunication!(siteData, body as Communication);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get communication by ID' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Resource', type: FhirResourceResponse })
  @ApiResponse({ status: 404, description: 'Not found', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async getCommunicationById(@Param('id') id: string, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).getCommunicationById(siteData, id);
  }
}
