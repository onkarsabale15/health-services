import { ApiProperty } from '@nestjs/swagger';

export class HealthIndicator {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status!: string;
}

export class HealthCheckResponseDto {
  @ApiProperty({ enum: ['ok', 'error'], example: 'ok' })
  status!: string;

  @ApiProperty({ example: { database: { status: 'up' }, redis: { status: 'up' } } })
  info!: Record<string, HealthIndicator>;

  @ApiProperty()
  error!: Record<string, HealthIndicator>;

  @ApiProperty({ example: { database: { status: 'up' }, redis: { status: 'up' } } })
  details!: Record<string, HealthIndicator>;
}
