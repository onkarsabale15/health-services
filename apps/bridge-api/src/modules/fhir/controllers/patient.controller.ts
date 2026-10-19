import { Patient } from '@medplum/fhirtypes';
import { Controller, Get, Post, Param, Query, Body, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { getVendorService } from '../../../services/vendor-service.factory';
import { SiteConfig } from '../decorators/integration-config.decorator';
import type { SiteData } from '@hs/ehr-data-service';
import { IntegrationDataInterceptor } from '../interceptors/integration-data.interceptor';
import { FhirCacheInterceptor } from '../interceptors/fhir-cache.interceptor';
import {
  PatientSearchParams,
  BaseFhirWriteDto,
  FhirBundleResponse,
  FhirResourceResponse,
  OperationOutcomeResponse,
} from '../dto';

@ApiTags('Patient')
@ApiBearerAuth()
@Controller('fhir/r4/v1/Patient')
@UseInterceptors(IntegrationDataInterceptor, FhirCacheInterceptor)
export class PatientController {
  @Get()
  @ApiOperation({ summary: 'Search patients' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of resources', type: FhirBundleResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  @ApiResponse({ status: 500, description: 'Server error', type: OperationOutcomeResponse })
  async getAllPatients(@Query() query: PatientSearchParams, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).searchPatient(siteData, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Resource', type: FhirResourceResponse })
  @ApiResponse({ status: 404, description: 'Not found', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async getPatientById(@Param('id') id: string, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).getPatientById(siteData, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create patient' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 201, description: 'Created resource', type: FhirResourceResponse })
  @ApiResponse({ status: 400, description: 'Validation error', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async createPatient(@Body() body: BaseFhirWriteDto, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).createPatient!(siteData, body as Patient);
  }
}
