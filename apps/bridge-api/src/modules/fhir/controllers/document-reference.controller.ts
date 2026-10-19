import { DocumentReference } from '@medplum/fhirtypes';
import { Controller, Get, Post, Body, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { getVendorService } from '../../../services/vendor-service.factory';
import { SiteConfig } from '../decorators/integration-config.decorator';
import type { SiteData } from '@hs/ehr-data-service';
import { IntegrationDataInterceptor } from '../interceptors/integration-data.interceptor';
import { FhirCacheInterceptor } from '../interceptors/fhir-cache.interceptor';
import {
  DocumentReferenceSearchParams,
  BaseFhirWriteDto,
  FhirBundleResponse,
  FhirResourceResponse,
  OperationOutcomeResponse,
} from '../dto';

@ApiTags('DocumentReference')
@ApiBearerAuth()
@Controller('fhir/r4/v1/DocumentReference')
@UseInterceptors(IntegrationDataInterceptor, FhirCacheInterceptor)
export class DocumentReferenceController {
  @Get()
  @ApiOperation({ summary: 'Search document references' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of resources', type: FhirBundleResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  @ApiResponse({ status: 500, description: 'Server error', type: OperationOutcomeResponse })
  async getAllDocumentReferences(@Query() query: DocumentReferenceSearchParams, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).searchDocumentReference(siteData, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create document reference' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 201, description: 'Created resource', type: FhirResourceResponse })
  @ApiResponse({ status: 400, description: 'Validation error', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async createDocumentReference(@Body() body: BaseFhirWriteDto, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).createDocumentReference!(siteData, body as DocumentReference);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document reference by ID' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Resource', type: FhirResourceResponse })
  @ApiResponse({ status: 404, description: 'Not found', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async getDocumentReferenceById(@Param('id') id: string, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).getDocumentReferenceById(siteData, id);
  }
}
