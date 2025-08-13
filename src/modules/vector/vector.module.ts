import { Module } from '@nestjs/common';
import { VectorController } from './vector.controller';
import { VectorService } from './vector.service';
import { PrismaModule } from 'src/utils/prisma/prisma.module';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [PrismaModule, ConversationModule],
  controllers: [VectorController],
  providers: [VectorService],
  exports: [VectorService],
})
export class VectorModule {}
