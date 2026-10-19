import { AllergyIntolerance } from '@medplum/fhirtypes';
import { Controller, Get, Post, Body, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { getVendorService } from '../../../services/vendor-service.factory';
import { SiteConfig } from '../decorators/integration-config.decorator';
import type { SiteData } from '@hs/ehr-data-service';
import { IntegrationDataInterceptor } from '../interceptors/integration-data.interceptor';
import { FhirCacheInterceptor } from '../interceptors/fhir-cache.interceptor';
import {
  AllergyIntoleranceSearchParams,
  AllergyWriteDto,
  FhirBundleResponse,
  FhirResourceResponse,
  OperationOutcomeResponse,
} from '../dto';

@ApiTags('AllergyIntolerance')
@ApiBearerAuth()
@Controller('fhir/r4/v1/AllergyIntolerance')
@UseInterceptors(IntegrationDataInterceptor, FhirCacheInterceptor)
export class AllergyIntoleranceController {
  @Get()
  @ApiOperation({ summary: 'Search allergy intolerances' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of resources', type: FhirBundleResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  @ApiResponse({ status: 500, description: 'Server error', type: OperationOutcomeResponse })
  async getAllAllergies(@Query() query: AllergyIntoleranceSearchParams, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).searchAllergy(siteData, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create allergy intolerance' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 201, description: 'Created resource', type: FhirResourceResponse })
  @ApiResponse({ status: 400, description: 'Validation error', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async createAllergy(@Body() body: AllergyWriteDto, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).createAllergy!(siteData, body as AllergyIntolerance);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get allergy intolerance by ID' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Resource', type: FhirResourceResponse })
  @ApiResponse({ status: 404, description: 'Not found', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async getAllergyById(@Param('id') id: string, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).getAllergyById(siteData, id);
  }
}
