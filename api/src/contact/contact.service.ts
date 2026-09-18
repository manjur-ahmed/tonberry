import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactMessage } from './contact-message.entity';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactMessagesRepository: Repository<ContactMessage>,
  ) {}

  async create(dto: CreateContactMessageDto): Promise<ContactMessage> {
    const message = this.contactMessagesRepository.create(dto);
    return this.contactMessagesRepository.save(message);
  }
}
