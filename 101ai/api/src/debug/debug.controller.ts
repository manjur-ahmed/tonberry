import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

const TEST_TYPES = ['http500', 'slow', 'notfound', 'log'] as const;
type TestType = (typeof TEST_TYPES)[number];

function isTestType(value: unknown): value is TestType {
  return typeof value === 'string' && (TEST_TYPES as readonly string[]).includes(value);
}

// Admin-only (see AdminGuard) — deliberately triggers a real failure so we
// can confirm the observability pipeline (CloudWatch alarms -> SNS email,
// structured logs, Grafana) actually picks it up end-to-end, on real prod
// infra rather than guessing. Never reachable by a regular user, and every
// path logs a "[TEST]" prefix so it's unmistakable in CloudWatch/Grafana
// that this was a deliberate test, not a real incident.
//
// Deliberately does NOT attempt to trigger a genuine Lambda-runtime-level
// failure (an unhandled promise rejection, process.exit, etc.) — Node
// treats an unhandled rejection as fatal by default, which risks crashing
// the shared warm execution environment mid-request. Everything here stays
// inside normal request/response handling: an uncaught error inside a
// route handler becomes a real HTTP 500 via Nest's exception filter (which
// is what the apigw_5xx alarm actually watches — a 500 *response*, not a
// raw Lambda crash, and those are different things), never a process crash.
@Controller('debug')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DebugController {
  private readonly logger = new Logger(DebugController.name);

  @Get('test-error')
  async testError(
    @Query('type') type?: string,
  ): Promise<{ ok: true; type: TestType }> {
    const testType = isTestType(type) ? type : 'log';

    switch (testType) {
      case 'http500':
        this.logger.warn('[TEST] Deliberately throwing to verify the apigw_5xx alarm/logs');
        throw new Error('[TEST] Deliberate 500 for observability verification');

      case 'slow':
        this.logger.warn('[TEST] Deliberately delaying 13s to verify the lambda_duration alarm');
        // Function timeout is 15s (see infra/backend_api.tf); the duration
        // alarm trips at 12s — this sits between the two, long enough to
        // trip the alarm, safely short of an actual timeout.
        await new Promise((resolve) => setTimeout(resolve, 13000));
        return { ok: true, type: testType };

      case 'notfound':
        this.logger.warn('[TEST] Deliberately 404ing to verify 4xx logging');
        throw new NotFoundException(
          '[TEST] Deliberate 404 for observability verification',
        );

      case 'log':
      default:
        this.logger.error('[TEST] Deliberate error-level log line, no real failure');
        return { ok: true, type: testType };
    }
  }
}
