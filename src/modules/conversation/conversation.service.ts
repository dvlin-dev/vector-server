import { Inject, Injectable, LoggerService } from '@nestjs/common'
import { CreateConversationDto } from './dto/create-conversation.dto'
import { PrismaService } from 'src/utils/prisma/prisma.service'
import { getKeyConfigurationFromEnvironment } from 'src/utils/llm/configuration'
import { CompletionsDto, CompletionsRegularDto } from './dto/chat.dto'
import { ConfigService } from '@nestjs/config'
import { ChatCompletionRequestMessage, Configuration, OpenAIApi, CreateChatCompletionRequest } from 'openai'
import { ModelType } from 'src/types/chat'
import { CreateMessageDto } from './dto/create-message.dto'
import { MessageSummaryService } from './message-summary.service'

import { Response } from 'express'
import { Readable } from 'stream'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'

@Injectable()
export class ConversationService {
  private openai: OpenAIApi
  private systemPrompt: string

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private messageSummaryService: MessageSummaryService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService
  ) {
    this.systemPrompt = this.configService.get('SYSTEM_PROMPT')
    this.logger.log('SYSTEM_PROMPT', this.systemPrompt);

    const keyConfiguration = getKeyConfigurationFromEnvironment(this.configService)

    // 初始化 OpenAI 客户端
    let configuration: Configuration

    if (keyConfiguration.apiType === ModelType.AZURE_OPENAI) {
      configuration = new Configuration({
        apiKey: keyConfiguration.azureApiKey,
        basePath: `https://${keyConfiguration.azureInstanceName}.openai.azure.com/openai/deployments/${keyConfiguration.azureDeploymentName}`,
        baseOptions: {
          headers: {
            'api-key': keyConfiguration.azureApiKey,
          },
          params: {
            'api-version': keyConfiguration.azureApiVersion,
          },
        },
      })
    } else {
      // 确保 apiKey 存在
      if (!keyConfiguration.apiKey) {
        console.error(
          'Missing OpenAI API key, please check the environment variable OPENAI_API_KEY'
        )
      }

      configuration = new Configuration({
        apiKey: keyConfiguration.apiKey,
      })

      // 只有当 basePath 存在时才设置
      if (keyConfiguration.basePath) {
        configuration.basePath = keyConfiguration.basePath
      }
    }

    this.openai = new OpenAIApi(configuration)

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
      const systemMessage: ChatCompletionRequestMessage = {
        role: 'system',
        content: this.systemPrompt,
      }
      const openaiMessages = [
        systemMessage,
        ...messages,
      ]

      const response = await this.openai.createChatCompletion({
        model: model || this.configService.get('OPENAI_API_MODEL') || 'gpt-4o',
        messages: openaiMessages, 
        temperature,
      })

      return response.data.choices[0].message.content
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
    const { messages, conversationId } = completionsDto

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
      
      const systemMessage: ChatCompletionRequestMessage = {
        role: 'system',
        content: this.systemPrompt,
      }

      // 使用优化后的上下文，而不是传入的所有消息
      const openaiMessages = [
        systemMessage,
        ...contextMessages,
      ]

      // 4. 使用 OpenAI API 发送流式请求
      const response = await this.openai.createChatCompletion(
        {
          model: this.configService.get('OPENAI_API_MODEL') || 'gpt-4o',
          messages: openaiMessages,
          temperature: 0.6,
          max_tokens: 2000,
          stream: true,
        },
        { responseType: 'stream' }
      )

      // 存储完整的响应
      let fullResponse = ''

      // 处理流式响应
      const stream = response.data as unknown as Readable

      // 为流设置编码
      stream.setEncoding('utf8')

      // 监听数据事件
      stream.on('data', (chunk: string) => {
        try {
          const lines = chunk
            .toString()
            .split('\n')
            .filter((line) => line.trim() !== '' && line.trim() !== 'data: [DONE]')

          for (const line of lines) {
            const message = line.replace(/^data: /, '').trim()

            // 跳过空消息
            if (!message) continue

            try {
              // 解析消息
              const data = JSON.parse(message)
              const content = data.choices[0]?.delta?.content || ''

              if (content) {
                // 更新完整响应
                fullResponse += content

                // 发送到客户端
                res.write(`data: ${JSON.stringify({ content })}\n\n`)
              }
            } catch (e) {
              console.error('Error parsing OpenAI response block:', e)
            }
          }
        } catch (error) {
          console.error('Error processing stream data:', error)
        }
      })

      // 监听完成事件
      stream.on('end', async () => {
        // 发送完成标记
        res.write('data: [DONE]\n\n')
        res.end()

        // 在流结束后，将完整响应保存到数据库
        if (fullResponse.trim()) {
          await this.createMessage({
            conversationId,
            content: fullResponse,
            role: 'assistant',
          })
        }
      })

      // 监听错误
      stream.on('error', (error) => {
        console.error('Stream error:', error)
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      })
    } catch (error) {
      console.error('OpenAI API stream response error:', error)

      // 发送错误信息给客户端
      res.write(`data: ${JSON.stringify({ error: 'request error' })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()

      throw error
    }
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
