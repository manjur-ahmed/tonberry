import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('system-status')
export class SystemStatusController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  async check() {
    const mlUrl = this.config.get<string>('ML_URL', 'http://127.0.0.1:8000');
    const ml = await this.checkMl(mlUrl);
    return { api: 'ok', ml };
  }

  private async checkMl(mlUrl: string): Promise<'ok' | 'error'> {
    try {
      const response = await fetch(`${mlUrl}/health`);
      return response.ok ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}
