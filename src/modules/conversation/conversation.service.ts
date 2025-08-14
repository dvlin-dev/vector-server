import { Inject, Injectable, LoggerService, forwardRef } from '@nestjs/common'
import { CreateConversationDto } from './dto/create-conversation.dto'
import { PrismaService } from 'src/utils/prisma/prisma.service'
import { getKeyConfigurationFromEnvironment } from 'src/utils/llm/configuration'
import { CompletionsDto, CompletionsRegularDto } from './dto/chat.dto'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { ModelType } from 'src/types/chat'
import { CreateMessageDto } from './dto/create-message.dto'
import { MessageSummaryService } from './message-summary.service'

import { Response } from 'express'
import { Readable } from 'stream'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { VectorService } from '../vector/vector.service'
import { systemPrompt } from 'src/utils/llm/prompt'

@Injectable()
export class ConversationService {
  private openai: OpenAI

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private messageSummaryService: MessageSummaryService,
    @Inject(forwardRef(() => VectorService))
    private vectorService: VectorService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService
  ) {
    const keyConfiguration = getKeyConfigurationFromEnvironment(this.configService)

    // 初始化 OpenAI 客户端
    if (keyConfiguration.apiType === ModelType.AZURE_OPENAI) {
      this.openai = new OpenAI({
        apiKey: keyConfiguration.azureApiKey,
        baseURL: `https://${keyConfiguration.azureInstanceName}.openai.azure.com/openai/deployments/${keyConfiguration.azureDeploymentName}`,
        defaultQuery: { 'api-version': keyConfiguration.azureApiVersion },
        defaultHeaders: {
          'api-key': keyConfiguration.azureApiKey,
        },
      })
    } else {
      // 确保 apiKey 存在
      if (!keyConfiguration.apiKey) {
        console.error(
          'Missing OpenAI API key, please check the environment variable OPENAI_API_KEY'
        )
      }

      this.openai = new OpenAI({
        apiKey: keyConfiguration.apiKey,
        baseURL: keyConfiguration.basePath,
      })
    }

    // 验证 API 密钥是否设置正确
    console.log('OpenAI configuration:', {
      apiType: keyConfiguration.apiType,
      hasApiKey: !!keyConfiguration.apiKey,
      apiModel: keyConfiguration.apiModel,
      basePath: keyConfiguration.basePath,
    })
  }

  get(id: string) {
    return this.prisma.conversation.findUnique({
      where: {
        id,
      },
      include: {
        messages: true,
      },
    })
  }

  getAll() {
    return this.prisma.conversation.findMany()
  }

  create(createConversationDto: CreateConversationDto) {
    const { abstract, siteId } = createConversationDto
    return this.prisma.conversation.create({
      data: {
        abstract: abstract || '',
        siteId,
      },
    })
  }

  delete(id: string) {
    return this.prisma.conversation.delete({
      where: {
        id,
      },
    })
  }

  /**
   * 通用的 AI 请求方法，直接透传 OpenAI 的 CreateChatCompletionRequest 格式
   * @param request OpenAI 的原生请求格式
   * @returns AI 的回复内容
   */
  async completions(request: CompletionsRegularDto): Promise<string> {
    try {
      const { messages, model, temperature } = request
      const systemMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
        role: 'system',
        content: systemPrompt,
      }
      const openaiMessages = [
        systemMessage,
        ...messages,
      ]

      const response = await this.openai.chat.completions.create({
        model: model || this.configService.get('OPENAI_API_MODEL') || 'gpt-4o',
        messages: openaiMessages, 
        temperature,
      })

      return response.choices[0].message.content
    } catch (error) {
      console.error('OpenAI API error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      })

      throw new Error(`Failed to call OpenAI API: ${error.message}`)
    }
  }

  async completionsStream(completionsDto: CompletionsDto, res: Response) {
    const { messages, conversationId, siteId } = completionsDto

    // 1. 保存用户发送的最后一条消息到数据库
    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage.role === 'user') {
      await this.createMessage({
        conversationId,
        content: lastUserMessage.content,
        role: lastUserMessage.role,
      })
    }

    try {
      // 2. 异步检查是否需要进行消息总结（不阻塞当前请求）
      this.handleMessageSummarization(conversationId).catch(error => {
        this.logger.error('消息总结处理失败', error)
      })

      // 3. 获取优化后的上下文消息（使用总结+最近消息）
      const contextMessages = await this.messageSummaryService.getContextMessages(conversationId)

      const systemMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
        role: 'system',
        content: systemPrompt,
      }

      const referenceMessages = await this.getReferenceMessages(siteId, contextMessages)
      // 使用优化后的上下文，而不是传入的所有消息
      const openaiMessages = [
        systemMessage,
        ...referenceMessages,
      ]

      const isGpt5 = this.configService.get('OPENAI_API_MODEL_2')?.includes('gpt-5');
      
      // 定义 function tool
      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [{
        type: 'function',
        function: {
          name: 'extract_unanswerable_question',
          description: '当背景信息不足以回答用户问题时，提取用户的核心问题',
          parameters: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: '用户的核心问题，精炼且清晰'
              },
              type: {
                type: 'string',
                description: '用户的问题类型，例如：产品咨询、售后服务、价格咨询、其他等'
              }
            },
            required: ['question', 'type']
          }
        }
      }];
      
      // 4. 使用 OpenAI API 发送流式请求
      const response = await this.openai.chat.completions.create({
        model: this.configService.get('OPENAI_API_MODEL_2') || 'gpt-4o',
        messages: openaiMessages,
        stream: true,
        tools: tools,
        ...(isGpt5 ? {
          verbosity: "low",
          reasoning_effort: "minimal"
        }:{})
      })

      // 存储完整的响应
      let fullResponse = ''

      // 处理流式响应 - 新版本 OpenAI SDK
      try {
        let toolCallId = null;
        let toolCallName = null;
        let toolCallArguments = '';
        let isCollectingToolCall = false;
        
        for await (const chunk of response) {
          // 处理工具调用开始
          if (chunk.choices[0]?.delta?.tool_calls?.[0]?.function) {
            const toolCall = chunk.choices[0].delta.tool_calls[0].function;
            
            // 如果是工具调用的开始部分
            if (toolCall.name) {
              isCollectingToolCall = true;
              toolCallId = chunk.choices[0].delta.tool_calls[0].index;
              toolCallName = toolCall.name;
              toolCallArguments = toolCall.arguments || '';
              continue;
            }
            
            // 如果是工具调用参数的继续部分
            if (isCollectingToolCall && toolCall.arguments) {
              toolCallArguments += toolCall.arguments;
              continue;
            }
          }
          
          // 处理普通内容
          const content = chunk.choices[0]?.delta?.content || '';
          
          if (content) {
            // 更新完整响应
            fullResponse += content;

            // 发送到客户端
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }
        
        // 如果收集到了工具调用，处理它
        if (isCollectingToolCall && toolCallName === 'extract_unanswerable_question') {
          try {
            const toolCallData = JSON.parse(toolCallArguments);
            // 发送工具调用结果到客户端
            res.write(`data: ${JSON.stringify({ 
              tool_call: {
                name: toolCallName,
                arguments: toolCallData
              }
            })}\n\n`);
            
          } catch (parseError) {
            console.error('解析工具调用参数失败:', parseError);
          }
        }

        // 发送完成标记
        res.write('data: [DONE]\n\n');
        res.end();

        // 在流结束后，将完整响应保存到数据库
        if (fullResponse.trim()) {
          await this.createMessage({
            conversationId,
            content: fullResponse,
            role: 'assistant',
          });
        }
      } catch (streamError) {
        console.error('Stream processing error:', streamError)
        res.write(`data: ${JSON.stringify({ error: 'system error' })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      }
    } catch (error) {
      console.error('OpenAI API stream response error:', error)

      // 发送错误信息给客户端
      res.write(`data: ${JSON.stringify({ error: 'system error' })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()

      throw error
    }
  }

  private async getReferenceMessages(siteId: string, contextMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    if (!siteId) {
      return contextMessages
    }

    const lastestUserMessage = contextMessages[contextMessages.length - 1];
    const remainingMessages = contextMessages.slice(0, -1);

    const reference = await this.vectorService.similaritySearch({
      message: lastestUserMessage.content as string,
      size: 1,
      siteId,
    })

    const referenceContent = `
<参考背景>
${reference.map(item => item.pageContent).join('\n')}
</参考背景>

<用户问题>
${lastestUserMessage.content}
</用户问题>
`
    const addReferenceUserMessages = {
      role: 'user',
      content: referenceContent,
    } as OpenAI.Chat.Completions.ChatCompletionUserMessageParam
    
    return [...remainingMessages, addReferenceUserMessages]
  }

  /**
   * 处理消息总结逻辑（异步执行，不阻塞主流程）
   */
  private async handleMessageSummarization(conversationId: string): Promise<void> {
    try {
      // 检查是否需要总结
      const shouldSummarize = await this.messageSummaryService.shouldSummarizeMessages(conversationId)
      
      if (shouldSummarize) {
        this.logger.log(`开始对话总结，对话ID: ${conversationId}`)
        await this.messageSummaryService.summarizeMessages(conversationId)
        this.logger.log(`对话总结完成，对话ID: ${conversationId}`)
      }
    } catch (error) {
      this.logger.error(`消息总结处理失败，对话ID: ${conversationId}`, error)
    }
  }

  // 消息相关方法
  getMessage(id: string) {
    return this.prisma.message.findUnique({
      where: {
        id,
      },
    })
  }

  /**
   * 获取对话消息（智能返回优化后的消息列表）
   * 当存在总结时，只显示最新总结后的消息，避免重复显示
   * 对前端完全透明
   */
  async getMessages(conversationId: string) {
    const lastSummary = await this.messageSummaryService.getLastSummaryMessage(conversationId)
    
    if (lastSummary) {
      // 如果有总结，返回总结 + 总结后的消息
      const messagesAfterSummary = await this.prisma.message.findMany({
        where: {
          conversationId,
          createdAt: { gt: lastSummary.createdAt },
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          content: true,
          role: true,
          createdAt: true,
        },
      })

      // 为总结消息添加特殊标识，前端可以据此进行特殊样式处理
      return [
        {
          id: lastSummary.id,
          content: `📋 [对话总结 - 包含${lastSummary.originalCount}条历史消息]\n\n${lastSummary.content}`,
          role: lastSummary.role,
          createdAt: lastSummary.createdAt,
        },
        ...messagesAfterSummary,
      ]
    } else {
      // 如果没有总结，返回所有非总结消息
      return this.prisma.message.findMany({
        where: {
          conversationId,
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          content: true,
          role: true,
          createdAt: true,
        },
      })
    }
  }

  /**
   * 获取对话的所有原始消息（包括总结消息，用于管理和调试）
   */
  getAllRawMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })
  }

  async createMessage(createMessageDto: CreateMessageDto) {
    const { conversationId, content, role } = createMessageDto

    // 创建消息
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        content,
        role,
        isSummary: false,
        createdAt: new Date(),
      },
    })

    return message
  }

  deleteMessage(id: string) {
    return this.prisma.message.delete({
      where: {
        id,
      },
    })
  }

}
