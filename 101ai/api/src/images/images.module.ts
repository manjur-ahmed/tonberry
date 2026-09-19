import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller';
import { WikipediaClient } from './wikipedia.client';
import { GoogleBooksClient } from './google-books.client';
import { AniListClient } from './anilist.client';

@Module({
  controllers: [ImagesController],
  providers: [WikipediaClient, GoogleBooksClient, AniListClient],
})
export class ImagesModule {}
