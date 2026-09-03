import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './lead.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { MlClientService } from '../ml/ml-client.service';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepository: Repository<Lead>,
    private readonly mlClient: MlClientService,
  ) {}

  async create(dto: CreateLeadDto): Promise<Lead> {
    const priorityScore = await this.mlClient.scoreLead({
      phone: dto.phone,
      propertyType: dto.propertyType,
      loanAmount: dto.loanAmount,
      message: dto.message,
    });

    const lead = this.leadsRepository.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone ?? null,
      propertyType: dto.propertyType ?? null,
      loanAmount: dto.loanAmount ?? null,
      message: dto.message ?? null,
      priorityScore,
    });
    return this.leadsRepository.save(lead);
  }
}
