import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';

@Controller()
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post('items')
  saveItem(@CurrentUser() user: User, @Body() dto: CreateItemDto) {
    return this.itemsService.saveItem(user.id, dto.toolSlug, dto.chatId, dto.title, dto.data, dto.dedupKey);
  }

  @Get('tools/:slug/items')
  getItemsForTool(@CurrentUser() user: User, @Param('slug') slug: string) {
    return this.itemsService.getItemsForTool(user.id, slug);
  }

  @Get('items')
  getAllItems(@CurrentUser() user: User) {
    return this.itemsService.getAllItems(user.id);
  }

  @Delete('items/:id')
  deleteItem(@CurrentUser() user: User, @Param('id') id: string) {
    return this.itemsService.deleteItem(user.id, id);
  }
}
