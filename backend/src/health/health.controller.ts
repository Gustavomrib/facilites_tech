import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  /** Liveness: is the process up? No dependency checks — used by orchestrators to decide restarts. */
  @Public()
  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([() => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024)]);
  }

  /** Readiness: can the app actually serve traffic? Checks the database connection. */
  @Public()
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.prismaIndicator.isHealthy('database')]);
  }
}
