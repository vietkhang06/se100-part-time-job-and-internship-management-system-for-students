import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService } from './health.service';
import { HealthResponseDto } from '@campusjob/contracts';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check API and Database Health Status' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service or database is unhealthy' })
  async getHealth(@Res() res: Response): Promise<void> {
    const health: HealthResponseDto = await this.healthService.checkHealth();
    const httpStatus = health.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    res.status(httpStatus).json(health);
  }
}
