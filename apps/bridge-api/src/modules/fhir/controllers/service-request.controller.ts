import { ServiceRequest } from '@medplum/fhirtypes';
import { Controller, Get, Post, Body, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { getVendorService } from '../../../services/vendor-service.factory';
import { SiteConfig } from '../decorators/integration-config.decorator';
import type { SiteData } from '@hs/ehr-data-service';
import { IntegrationDataInterceptor } from '../interceptors/integration-data.interceptor';
import { FhirCacheInterceptor } from '../interceptors/fhir-cache.interceptor';
import {
  ServiceRequestSearchParams,
  BaseFhirWriteDto,
  FhirBundleResponse,
  FhirResourceResponse,
  OperationOutcomeResponse,
} from '../dto';

@ApiTags('ServiceRequest')
@ApiBearerAuth()
@Controller('fhir/r4/v1/ServiceRequest')
@UseInterceptors(IntegrationDataInterceptor, FhirCacheInterceptor)
export class ServiceRequestController {
  @Get()
  @ApiOperation({ summary: 'Search service requests' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of resources', type: FhirBundleResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  @ApiResponse({ status: 500, description: 'Server error', type: OperationOutcomeResponse })
  async getAllServiceRequests(@Query() query: ServiceRequestSearchParams, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).searchServiceRequest(siteData, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create service request' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 201, description: 'Created resource', type: FhirResourceResponse })
  @ApiResponse({ status: 400, description: 'Validation error', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async createServiceRequest(@Body() body: BaseFhirWriteDto, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).createServiceRequest!(siteData, body as ServiceRequest);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get service request by ID' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Resource', type: FhirResourceResponse })
  @ApiResponse({ status: 404, description: 'Not found', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async getServiceRequestById(@Param('id') id: string, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).getServiceRequestById(siteData, id);
  }
}
