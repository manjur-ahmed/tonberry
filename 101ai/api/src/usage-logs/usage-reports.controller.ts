import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
// TEMP: JwtAuthGuard/AdminGuard imports removed along with @UseGuards below
// — restore both (see git blame / earlier version) once the guards go
// back on.

const RANGES = ['7d', '30d', '90d'] as const;
type Range = (typeof RANGES)[number];

// Purely a fixed lookback window — unlike the old day/week/month "period",
// this doesn't also control bucket size. The time series below always
// buckets by day regardless of range.
const LOOKBACK_INTERVAL: Record<Range, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

function parseRange(value: unknown): Range {
  if (typeof value !== 'string' || !RANGES.includes(value as Range)) {
    throw new BadRequestException(`range must be one of: ${RANGES.join(', ')}`);
  }
  return value as Range;
}

interface TimeSeriesRow {
  date: string;
  total_cost: string;
  request_count: string;
}

interface ByModelRow {
  model: string;
  total_cost: string;
  total_tokens: string;
  request_count: string;
}

interface PerUserRow {
  avg_cost: string;
  user_count: string;
}

interface ByPlanRow {
  plan: string | null;
  total_cost: string;
  avg_cost_per_response: string;
  request_count: string;
  user_count: string;
}

@Controller('admin/usage')
// TEMP: guards lifted for local iteration — RESTORE @UseGuards(JwtAuthGuard, AdminGuard) before this ships anywhere.
export class UsageReportsController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get('summary')
  async getSummary(@Query('range') rangeParam: unknown) {
    const range = parseRange(rangeParam ?? '30d');
    const interval = LOOKBACK_INTERVAL[range];

    const [
      perResponseRows,
      perChatRows,
      perUserRows,
      timeSeriesRows,
      byModelRows,
      byPlanRows,
    ] = await Promise.all([
      this.dataSource.query<{ avg_cost: string | null; count: string }[]>(
        `SELECT COALESCE(AVG(cost_usd), 0) AS avg_cost, COUNT(*)::int AS count
         FROM ai_usage_logs
         WHERE created_at >= now() - $1::interval`,
        [interval],
      ),
      this.dataSource.query<{ avg_cost: string | null; chat_count: string }[]>(
        `SELECT COALESCE(AVG(chat_total), 0) AS avg_cost, COUNT(*)::int AS chat_count
         FROM (
           SELECT chat_id, SUM(cost_usd) AS chat_total
           FROM ai_usage_logs
           WHERE created_at >= now() - $1::interval AND chat_id IS NOT NULL
           GROUP BY chat_id
         ) chat_totals`,
        [interval],
      ),
      this.dataSource.query<PerUserRow[]>(
        `SELECT COALESCE(AVG(user_total), 0) AS avg_cost, COUNT(*)::int AS user_count
         FROM (
           SELECT user_id, SUM(cost_usd) AS user_total
           FROM ai_usage_logs
           WHERE created_at >= now() - $1::interval
           GROUP BY user_id
         ) user_totals`,
        [interval],
      ),
      this.dataSource.query<TimeSeriesRow[]>(
        `SELECT date_trunc('day', created_at) AS date,
                SUM(cost_usd) AS total_cost, COUNT(*)::int AS request_count
         FROM ai_usage_logs
         WHERE created_at >= now() - $1::interval
         GROUP BY date
         ORDER BY date`,
        [interval],
      ),
      this.dataSource.query<ByModelRow[]>(
        `SELECT model,
                SUM(cost_usd) AS total_cost, SUM(total_tokens)::int AS total_tokens, COUNT(*)::int AS request_count
         FROM ai_usage_logs
         WHERE created_at >= now() - $1::interval
         GROUP BY model
         ORDER BY model`,
        [interval],
      ),
      this.dataSource.query<ByPlanRow[]>(
        `SELECT u.plan,
                COALESCE(SUM(l.cost_usd), 0) AS total_cost,
                COALESCE(AVG(l.cost_usd), 0) AS avg_cost_per_response,
                COUNT(*)::int AS request_count,
                COUNT(DISTINCT l.user_id)::int AS user_count
         FROM ai_usage_logs l
         JOIN users u ON u.id = l.user_id
         WHERE l.created_at >= now() - $1::interval
         GROUP BY u.plan
         ORDER BY u.plan`,
        [interval],
      ),
    ]);

    return {
      range,
      perResponse: {
        averageCostUsd: Number(perResponseRows[0]?.avg_cost ?? 0),
        count: Number(perResponseRows[0]?.count ?? 0),
      },
      perChat: {
        averageCostUsd: Number(perChatRows[0]?.avg_cost ?? 0),
        chatCount: Number(perChatRows[0]?.chat_count ?? 0),
      },
      perUser: {
        averageCostUsd: Number(perUserRows[0]?.avg_cost ?? 0),
        userCount: Number(perUserRows[0]?.user_count ?? 0),
      },
      timeSeries: timeSeriesRows.map((row) => ({
        date: row.date,
        totalCostUsd: Number(row.total_cost),
        requestCount: Number(row.request_count),
      })),
      byModel: byModelRows.map((row) => ({
        model: row.model,
        totalCostUsd: Number(row.total_cost),
        totalTokens: Number(row.total_tokens),
        requestCount: Number(row.request_count),
      })),
      byPlan: byPlanRows.map((row) => ({
        plan: row.plan as 'free' | 'plus' | 'premium' | null,
        totalCostUsd: Number(row.total_cost),
        avgCostPerResponseUsd: Number(row.avg_cost_per_response),
        requestCount: Number(row.request_count),
        userCount: Number(row.user_count),
      })),
    };
  }
}
