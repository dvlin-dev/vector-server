import { Injectable, Inject, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from 'src/utils/prisma/prisma.service'
import OpenAI from 'openai'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { getKeyConfigurationFromEnvironment } from 'src/utils/llm/configuration'
import { Message, MessageRole } from '@prisma/client'

export interface SummaryMetadata {
  originalMessageIds: string[]
  originalMessageCount: number
  timeRange: {
    start: Date
    end: Date
  }
  summaryCreatedAt: Date
}

@Injectable()
export class MessageSummaryService {
  private openai: OpenAI
  private readonly SUMMARY_BATCH_SIZE = 10 // 每10轮消息进行一次总结
  private readonly CONTEXT_LIMIT = 10 // 最多保留最近10条消息作为上下文

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService
  ) {
    const keyConfiguration = getKeyConfigurationFromEnvironment(this.configService)
    this.openai = new OpenAI({
      apiKey: keyConfiguration.apiKey,
      baseURL: keyConfiguration.basePath,
    })
  }

  /**
   * 检查是否需要进行消息总结
   * @param conversationId 对话ID
   * @returns 是否需要总结
   */
  async shouldSummarizeMessages(conversationId: string): Promise<boolean> {
    // 获取对话中的所有非总结消息数量
    const messageCount = await this.prisma.message.count({
      where: {
        conversationId,
        OR: [
          { isSummary: false },
          { isSummary: null }
        ],
        role: { in: ['user', 'assistant'] }, // 只统计用户和助手的消息，排除系统消息
      },
    })

    // 如果消息数量超过阈值，检查是否有未总结的消息批次
    if (messageCount >= this.SUMMARY_BATCH_SIZE) {
      const lastSummary = await this.getLastSummaryMessage(conversationId)
      if (!lastSummary) {
        // 没有任何总结，需要总结
        return messageCount >= this.SUMMARY_BATCH_SIZE
      }

      // 计算自上次总结后的消息数量
      const messagesAfterLastSummary = await this.prisma.message.count({
        where: {
          conversationId,
          OR: [
            { isSummary: false },
            { isSummary: null }
          ],
          role: { in: ['user', 'assistant'] },
          createdAt: { gt: lastSummary.createdAt },
        },
      })

      return messagesAfterLastSummary >= this.SUMMARY_BATCH_SIZE
    }

    return false
  }

  /**
   * 获取最后一条总结消息
   */
  async getLastSummaryMessage(conversationId: string): Promise<Message | null> {
    return this.prisma.message.findFirst({
      where: {
        conversationId,
        isSummary: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  /**
   * 执行消息总结
   * @param conversationId 对话ID
   */
  async summarizeMessages(conversationId: string): Promise<void> {
    try {
      const lastSummary = await this.getLastSummaryMessage(conversationId)
      
      // 获取需要总结的消息
      const messagesToSummarize = await this.prisma.message.findMany({
        where: {
          conversationId,
          OR: [
            { isSummary: false },
            { isSummary: null }
          ],
          role: { in: ['user', 'assistant'] },
          ...(lastSummary ? { createdAt: { gt: lastSummary.createdAt } } : {}),
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: this.SUMMARY_BATCH_SIZE,
      })

      if (messagesToSummarize.length < this.SUMMARY_BATCH_SIZE) {
        return // 不足一个批次，不进行总结
      }

      // 生成总结
      const summary = await this.generateSummary(messagesToSummarize)
      
      if (summary) {
        // 创建总结消息的元数据
        const summaryMetadata: SummaryMetadata = {
          originalMessageIds: messagesToSummarize.map(msg => msg.id),
          originalMessageCount: messagesToSummarize.length,
          timeRange: {
            start: messagesToSummarize[0].createdAt,
            end: messagesToSummarize[messagesToSummarize.length - 1].createdAt,
          },
          summaryCreatedAt: new Date(),
        }

        // 保存总结消息
        await this.prisma.message.create({
          data: {
            conversationId,
            content: summary,
            role: MessageRole.assistant,
            isSummary: true,
            summaryData: summaryMetadata as any, // Prisma JSON 类型的兼容性处理
            originalCount: messagesToSummarize.length,
          },
        })

        this.logger.log(`成功总结了 ${messagesToSummarize.length} 条消息，对话ID: ${conversationId}`)
      }
    } catch (error) {
      this.logger.error(`消息总结失败，对话ID: ${conversationId}`, error)
    }
  }

  /**
   * 使用AI生成消息总结
   */
  private async generateSummary(messages: Message[]): Promise<string | null> {
    try {
      // 构建对话历史
      const conversationHistory = messages.map(msg => 
        `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`
      ).join('\n\n')

      const summaryPrompt = `请对以下对话进行简洁的总结，保留关键信息和上下文，以便后续对话能够延续：

${conversationHistory}

请用简洁的语言总结上述对话的要点，包括：
1. 主要讨论的话题或问题
2. 达成的共识或结论
3. 需要继续跟进的事项（如果有）

总结应该简洁明了，便于理解对话的核心内容。`

      const response = await this.openai.chat.completions.create({
        model: this.configService.get('OPENAI_API_MODEL') || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的对话总结助手，能够准确提取对话的关键信息并进行简洁的总结。'
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        temperature: 0.3,
      })

      return response.choices[0]?.message?.content || null
    } catch (error) {
      this.logger.error('AI总结生成失败', error)
      return null
    }
  }

  /**
   * 获取用于对话的消息上下文
   * 优先使用最新的总结 + 最近的消息，而不是所有历史消息
   */
  async getContextMessages(conversationId: string): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const lastSummary = await this.getLastSummaryMessage(conversationId)
    const contextMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
    if (lastSummary) {
      // 添加总结作为上下文
      contextMessages.push({
        role: 'assistant',
        content: `[之前的对话总结] ${lastSummary.content}`,
      })

      // 获取总结之后的消息
      const recentMessages = await this.prisma.message.findMany({
        where: {
          conversationId,
          OR: [
            { isSummary: false },
            { isSummary: null }
          ],
          createdAt: { gt: lastSummary.createdAt },
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: this.CONTEXT_LIMIT,
      })

      // 添加最近的消息
      contextMessages.push(
        ...recentMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }))
      )
    } else {
      // 没有总结，获取最近的消息
      const recentMessages = await this.prisma.message.findMany({
        where: {
          conversationId,
          OR: [
            { isSummary: false },
            { isSummary: null }
          ],
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: this.CONTEXT_LIMIT,
      })

      contextMessages.push(
        ...recentMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }))
      )
    }

    return contextMessages
  }
}
