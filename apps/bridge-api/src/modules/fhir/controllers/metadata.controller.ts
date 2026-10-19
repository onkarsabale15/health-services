import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { FHIR_ROUTE_REGISTRY } from '@hs/config';

@ApiTags('FHIR Metadata')
@Controller('fhir/r4/v1')
export class MetadataController {
  @Get('metadata')
  @Public()
  @ApiOperation({ summary: 'FHIR CapabilityStatement (server metadata)' })
  @ApiResponse({ status: 200, description: 'FHIR CapabilityStatement' })
  getCapabilityStatement() {
    // Build rest.resource from the route registry
    const resourceMap = new Map<string, { type: string; interaction: { code: string }[] }>();

    for (const entry of FHIR_ROUTE_REGISTRY) {
      if (!resourceMap.has(entry.resource)) {
        resourceMap.set(entry.resource, {
          type: entry.resource,
          interaction: [],
        });
      }

      const res = resourceMap.get(entry.resource)!;
      let interactionCode: string;

      if (entry.method === 'GET' && entry.path.includes(':id')) {
        interactionCode = 'read';
      } else if (entry.method === 'GET') {
        interactionCode = 'search-type';
      } else if (entry.method === 'POST') {
        interactionCode = 'create';
      } else if (entry.method === 'PUT') {
        interactionCode = 'update';
      } else if (entry.method === 'PATCH') {
        interactionCode = 'patch';
      } else if (entry.method === 'DELETE') {
        interactionCode = 'delete';
      } else {
        continue;
      }

      if (!res.interaction.some((i) => i.code === interactionCode)) {
        res.interaction.push({ code: interactionCode });
      }
    }

    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString(),
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [
        {
          mode: 'server',
          security: {
            cors: true,
            service: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                    code: 'SMART-on-FHIR',
                  },
                ],
                text: 'OAuth2 using SMART-on-FHIR profile',
              },
            ],
          },
          resource: [...resourceMap.values()].sort((a, b) => a.type.localeCompare(b.type)),
        },
      ],
    };
  }
}
