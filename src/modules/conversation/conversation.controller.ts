import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Inject,
  LoggerService,
  Param,
  Post,
  UseInterceptors,
  Res,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ConversationService } from './conversation.service'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { CreateConversationDto } from './dto/create-conversation.dto'

import { CompletionsDto } from './dto/chat.dto'
import { CreateMessageDto } from './dto/create-message.dto'

import { Response } from 'express'

@ApiTags('Conversation')
@UseInterceptors(ClassSerializerInterceptor)
@Controller('conversation')
export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService
  ) {}

  @ApiOperation({ summary: 'Get conversation details' })
  @ApiResponse({ status: 200, description: 'Successfully get conversation details' })
  @Get(':id/detail')
  get(@Param('id') id: string) {
    return this.conversationService.get(id)
  }

  @ApiOperation({ summary: 'Get conversation list' })
  @ApiResponse({ status: 200, description: 'Successfully get conversation list' })
  @Get('list')
  async getAll() {
    return this.conversationService.getAll()
  }

  @ApiOperation({ summary: 'Create conversation' })
  @Post()
  create(@Body() createConversationDto: CreateConversationDto) {
    return this.conversationService.create(createConversationDto)
  }

  @ApiOperation({ summary: 'Delete conversation' })
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.conversationService.delete(id)
  }

  @ApiOperation({ summary: 'completions' })
  @ApiResponse({ status: 200, description: 'Successfully get completions' })
  @Post('/completions')
  async completions(@Body() completionsDto: CompletionsDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    // 使用流式接口
    await this.conversationService.completionsStream(completionsDto, res)
  }

  @ApiOperation({ summary: 'completions (non-streaming)' })
  @ApiResponse({ status: 200, description: 'Successfully get completions' })
  @Post('/completions-regular')
  async completionsRegular(@Body() completionsDto: CompletionsDto) {
    return this.conversationService.completionsRegular(completionsDto)
  }

  // 消息相关接口
  @ApiOperation({ summary: 'Get message details' })
  @ApiResponse({ status: 200, description: 'Successfully get message details' })
  @Get('/message/:id/detail')
  getMessage(@Param('id') id: string) {
    return this.conversationService.getMessage(id)
  }

  @ApiOperation({ summary: 'Get message list' })
  @ApiResponse({ status: 200, description: 'Successfully get message list' })
  @Get('/message/:conversationId/list')
  async getMessages(@Param('conversationId') conversationId: string) {
    return this.conversationService.getMessages(conversationId)
  }

  @ApiOperation({ summary: 'Create message' })
  @Post('/message')
  createMessage(@Body() createMessageDto: CreateMessageDto) {
    return this.conversationService.createMessage(createMessageDto)
  }

  @ApiOperation({ summary: 'Delete message' })
  @Delete('/message/:id')
  deleteMessage(@Param('id') id: string) {
    return this.conversationService.deleteMessage(id)
  }
}
