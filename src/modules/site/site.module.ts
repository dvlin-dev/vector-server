import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SiteService } from './site.service';
import { SiteController } from './site.controller';
import { PrismaModule } from '../../utils/prisma/prisma.module';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [PrismaModule, ConversationModule, ConfigModule],
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService]
})
export class SiteModule {}
