import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ScoreLeadInput {
  phone?: string | null;
  propertyType?: string | null;
  loanAmount?: string | null;
  message?: string | null;
}

@Injectable()
export class MlClientService {
  constructor(private readonly config: ConfigService) {}

  // Best-effort: a lead is still worth saving even if the ML service is down.
  async scoreLead(input: ScoreLeadInput): Promise<number | null> {
    const mlUrl = this.config.get<string>('ML_URL', 'http://127.0.0.1:8000');
    try {
      const response = await fetch(`${mlUrl}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: input.phone ?? null,
          property_type: input.propertyType ?? null,
          loan_amount: input.loanAmount ? Number(input.loanAmount) : null,
          message: input.message ?? null,
        }),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { priority_score: number };
      return body.priority_score;
    } catch {
      return null;
    }
  }
}
