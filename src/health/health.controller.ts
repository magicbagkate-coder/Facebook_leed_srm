import { Controller, Get } from '@nestjs/common';

type HealthStatus = {
  status: 'ok';
};

@Controller('health')
export class HealthController {
  @Get()
  getStatus(): HealthStatus {
    return { status: 'ok' };
  }
}
