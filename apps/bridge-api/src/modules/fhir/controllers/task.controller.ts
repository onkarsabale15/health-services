import { Task } from '@medplum/fhirtypes';
import { Controller, Get, Post, Put, Param, Query, Body, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { getVendorService } from '../../../services/vendor-service.factory';
import { SiteConfig } from '../decorators/integration-config.decorator';
import type { SiteData } from '@hs/ehr-data-service';
import { IntegrationDataInterceptor } from '../interceptors/integration-data.interceptor';
import { FhirCacheInterceptor } from '../interceptors/fhir-cache.interceptor';
import {
  TaskSearchParams,
  BaseFhirWriteDto,
  FhirBundleResponse,
  FhirResourceResponse,
  OperationOutcomeResponse,
} from '../dto';

@ApiTags('Task')
@ApiBearerAuth()
@Controller('fhir/r4/v1/Task')
@UseInterceptors(IntegrationDataInterceptor, FhirCacheInterceptor)
export class TaskController {
  @Get()
  @ApiOperation({ summary: 'Search tasks' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Bundle of resources', type: FhirBundleResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  @ApiResponse({ status: 500, description: 'Server error', type: OperationOutcomeResponse })
  async getAllTasks(@Query() query: TaskSearchParams, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).searchTask(siteData, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'FHIR Resource', type: FhirResourceResponse })
  @ApiResponse({ status: 404, description: 'Not found', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async getTaskById(@Param('id') id: string, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).getTaskById(siteData, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create task' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 201, description: 'Created resource', type: FhirResourceResponse })
  @ApiResponse({ status: 400, description: 'Validation error', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async createTask(@Body() body: BaseFhirWriteDto, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).createTask!(siteData, body as Task);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update task' })
  @ApiHeader({ name: 'SiteId', required: true, description: 'Site identifier (EhrSiteConfig ID)' })
  @ApiResponse({ status: 200, description: 'Updated resource', type: FhirResourceResponse })
  @ApiResponse({ status: 400, description: 'Validation error', type: OperationOutcomeResponse })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: OperationOutcomeResponse })
  async updateTask(@Param('id') id: string, @Body() body: BaseFhirWriteDto, @SiteConfig() siteData: SiteData) {
    return getVendorService(siteData.ehrName).updateTask!(siteData, id, body as Task);
  }
}
