import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Suggestion } from './suggestion.entity';

@Injectable()
export class SuggestionsService {
  constructor(
    @InjectRepository(Suggestion)
    private readonly suggestionsRepository: Repository<Suggestion>,
  ) {}

  create(userId: string, userEmail: string, content: string): Promise<Suggestion> {
    return this.suggestionsRepository.save(
      this.suggestionsRepository.create({ userId, userEmail, content }),
    );
  }

  findAll(): Promise<Suggestion[]> {
    return this.suggestionsRepository.find({ order: { createdAt: 'DESC' } });
  }
}
