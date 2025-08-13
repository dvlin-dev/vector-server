import { Injectable, NotFoundException, ConflictException, Inject, LoggerService } from '@nestjs/common';
import { PrismaService } from '../../utils/prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto, TicketStatus } from './dto/update-ticket.dto';
import { SummarizeSiteDto } from './dto/summarize-site.dto';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { ConversationService } from '../conversation/conversation.service';
import { MessageRole } from '../conversation/dto/chat.dto';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

@Injectable()
export class SiteService {
  private openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationService: ConversationService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService
  ) {
    // 初始化 OpenAI 客户端
    this.openai = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY'),
      baseURL: this.configService.get('OPENAI_BASE_URL'),
    });
  }

  // Site 相关方法
  async createSite(createSiteDto: CreateSiteDto) {
    try {
      return await this.prisma.site.create({
        data: createSiteDto,
        include: {
          tickets: true
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('站点ID已存在');
      }
      throw error;
    }
  }

  async findAllSites() {
    return await this.prisma.site.findMany({
      include: {
        tickets: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findOneSite(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: {
        tickets: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!site) {
      throw new NotFoundException('站点不存在');
    }

    return site;
  }

  async findSiteBySiteId(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { siteId },
      include: {
        tickets: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!site) {
      throw new NotFoundException('站点不存在');
    }

    return site;
  }

  async updateSite(id: string, updateSiteDto: UpdateSiteDto) {
    try {
      const site = await this.prisma.site.update({
        where: { id },
        data: updateSiteDto,
        include: {
          tickets: true
        }
      });
      return site;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('站点不存在');
      }
      if (error.code === 'P2002') {
        throw new ConflictException('站点ID已存在');
      }
      throw error;
    }
  }

  async removeSite(id: string) {
    try {
      await this.prisma.site.delete({
        where: { id }
      });
      return { message: '站点删除成功' };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('站点不存在');
      }
      throw error;
    }
  }

  // Ticket 相关方法
  async createTicket(createTicketDto: CreateTicketDto) {
    // 检查站点是否存在
    await this.findOneSite(createTicketDto.siteId);

    return await this.prisma.ticket.create({
      data: createTicketDto,
      include: {
        site: true
      }
    });
  }

  async findAllTickets(siteId?: string, status?: TicketStatus) {
    const where: any = {};
    
    if (siteId) {
      where.siteId = siteId;
    }
    
    if (status && Object.values(TicketStatus).includes(status)) {
      where.status = status;
    }
    
    return await this.prisma.ticket.findMany({
      where,
      include: {
        site: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findOneTicket(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        site: true
      }
    });

    if (!ticket) {
      throw new NotFoundException('工单不存在');
    }

    return ticket;
  }

  async updateTicket(id: string, updateTicketDto: UpdateTicketDto) {
    try {
      const ticket = await this.prisma.ticket.update({
        where: { id },
        data: {
          ...updateTicketDto,
          updatedAt: new Date()
        },
        include: {
          site: true
        }
      });
      return ticket;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('工单不存在');
      }
      throw error;
    }
  }

  async removeTicket(id: string) {
    try {
      await this.prisma.ticket.delete({
        where: { id }
      });
      return { message: '工单删除成功' };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException('工单不存在');
      }
      throw error;
    }
  }

  // 统计相关方法
  async getSiteStats(siteId: string) {
    const site = await this.findOneSite(siteId);
    
    const ticketStats = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: {
        siteId
      },
      _count: {
        status: true
      }
    });

    const stats = {
      totalTickets: site.tickets.length,
      pendingTickets: ticketStats.find(stat => stat.status === 'PENDING')?._count.status || 0,
      processedTickets: ticketStats.find(stat => stat.status === 'PROCESSED')?._count.status || 0
    };

    return {
      site: {
        id: site.id,
        siteId: site.siteId,
        description: site.description,
        createdAt: site.createdAt
      },
      stats
    };
  }

  // AI总结相关方法
  async summarizeAndUpdateSiteDescription(summarizeSiteDto: SummarizeSiteDto) {
    const { siteId, content } = summarizeSiteDto;

    try {
      // 首先检查站点是否存在
      const site = await this.findSiteBySiteId(siteId);

      // 使用AI生成站点描述总结
      const summary = await this.generateSiteSummary(content);

      if (!summary) {
        throw new Error('AI总结生成失败');
      }

      // 更新站点描述
      const updatedSite = await this.updateSite(site.id, { description: summary });

      return {
        success: true,
        summary,
        site: updatedSite
      };
    } catch (error) {
      this.logger.error(`站点描述总结失败，站点ID: ${siteId}`, error);
      throw error;
    }
  }

  /**
   * 使用AI生成站点描述总结
   */
  private async generateSiteSummary(content: string): Promise<string | null> {
    try {
      const summaryPrompt = `请根据以下内容为网站生成一个简洁明了的描述总结，描述应该包含网站的主要功能、服务或特色，长度控制在100字以内：

${content}

请生成一个专业、准确、简洁的网站描述总结。`;

      const response = await this.conversationService.completions({
        messages: [
          {
            role: MessageRole.system,
            content: '你是一个专业的网站内容分析助手，能够准确提取网站的核心信息并生成简洁明了的描述总结。'
          },
          {
            role: MessageRole.user, 
            content: summaryPrompt
          }
        ],
        model:  this.configService.get('OPENAI_API_MODEL') || 'moonshotai/kimi-k2-instruct',
        temperature: 0.3
      });

      return response?.trim() || null;
    } catch (error) {
      this.logger.error('AI站点描述总结生成失败', error);
      return null;
    }
  }

  /**
   * 生成访问网站时可能想问的问题
   */
  async generateQuestions(generateQuestionsDto: GenerateQuestionsDto): Promise<{ list: string[] }> {
    const { content } = generateQuestionsDto;

    try {
      // 定义 Zod schema 用于结构化输出
      const QuestionsSchema = z.object({
        questions: z.array(z.string()).describe("生成的3个问题列表")
      });

      type QuestionsType = z.infer<typeof QuestionsSchema>;

      const questionsPrompt = `根据以下网站内容，生成3个访问者浏览该网站时可能想要了解的问题。这些问题应该：
1. 与网站内容密切相关
2. 帮助用户更好地了解网站的服务或产品
3. 具有实际的参考价值

网站内容：
${content}

请生成3个具体的、有价值的问题。`;

      // 使用 zodResponseFormat 进行结构化输出
      const completion = await this.openai.chat.completions.parse({
        model: this.configService.get('OPENAI_API_MODEL_2') || 'gpt-4o-2024-08-06',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的内容分析师，能够根据网站内容生成用户可能感兴趣的问题。生成的问题应该具体、有价值、与内容相关。'
          },
          {
            role: 'user',
            content: questionsPrompt
          }
        ],
        response_format: zodResponseFormat(QuestionsSchema as any, "questions_response"),
        temperature: 0.3,
      });

      const result = completion.choices[0]?.message?.parsed as QuestionsType;
      
      if (result && result.questions) {
        return { list: result.questions };
      }

      // 如果解析失败，抛出错误进入catch块
      throw new Error('结构化输出解析失败');

    } catch (error) {
      this.logger.error('AI问题生成失败', error);
      // 返回默认问题
      return {
        list: [
          'What is the main function of this website?',
          'How to use the services of this website?',
          'What are the features or advantages of this website?'
        ]
      };
    }
  }
}
