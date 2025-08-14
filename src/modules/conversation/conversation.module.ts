import { Module, forwardRef } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { MessageSummaryService } from './message-summary.service';
import { PrismaModule } from 'src/utils/prisma/prisma.module';
import { VectorModule } from '../vector/vector.module';

@Module({
  imports: [PrismaModule, forwardRef(() => VectorModule)],
  controllers: [ConversationController],
  providers: [ConversationService, MessageSummaryService],
  exports: [ConversationService, MessageSummaryService],
})
export class ConversationModule {}
