import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { MessageSummaryService } from './message-summary.service';

@Module({
  controllers: [ConversationController],
  providers: [ConversationService, MessageSummaryService],
  exports: [ConversationService, MessageSummaryService],
})
export class ConversationModule {}
