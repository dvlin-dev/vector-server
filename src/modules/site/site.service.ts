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
import { getQuestionsUserPrompt, getSiteSummaryUserPrompt, questionsSystemPrompt, siteSummarySystemPrompt } from 'src/utils/llm/prompt';
import { VectorService } from '../vector/vector.service';

@Injectable()
export class SiteService {
  private openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationService: ConversationService,
    private readonly configService: ConfigService,
    private readonly vectorService: VectorService,
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

  async updateSiteBySiteId(siteId: string, updateSiteDto: UpdateSiteDto) {
    try {
      const site = await this.prisma.site.update({
        where: { siteId },
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

  async removeSiteBySiteId(siteId: string) {
    try {
      await this.prisma.site.delete({
        where: { siteId }
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
    const site = await this.findSiteBySiteId(createTicketDto.siteId);

    return await this.prisma.ticket.create({
      data: {
        content: createTicketDto.content,
        visitorEmail: createTicketDto.visitorEmail,
        type: createTicketDto.type,
        siteId: site.id,
        status: TicketStatus.PENDING
      },
      include: {
        site: true
      }
    });
  }

  async findAllTickets(siteId?: string, status?: TicketStatus) {
    const where: any = {};
    
    if (siteId) {
      // 先查找对应的site记录，获取其内部id
      const site = await this.prisma.site.findUnique({
        where: { siteId }
      });
      
      // 如果找到了site，使用其id作为查询条件
      if (site) {
        where.siteId = site.id;
      } else {
        // 如果找不到对应的site，返回空数组
        return [];
      }
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

      const response = await this.conversationService.completions({
        messages: [
          {
            role: MessageRole.system,
            content: siteSummarySystemPrompt
          },
          {
            role: MessageRole.user, 
            content: getSiteSummaryUserPrompt(content)
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
  async generateQuestions(generateQuestionsDto: GenerateQuestionsDto): Promise<{ list: string[]; greet: string }> {
    const { siteId, sectionId } = generateQuestionsDto;

    try {
      // 1. 通过 vectorService.list 获取区块的向量数据信息
      const vectorData = await this.vectorService.list({
        siteId,
        sectionId,
        page: 1,
        pageSize: 1
      });

      // 2. 通过 siteId 获取网站信息
      const siteInfo = await this.findSiteBySiteId(siteId);
      const siteDescription = siteInfo.description;

      // 3. 整合区块信息和网站信息
      const sectionContent = vectorData.items[0].content;
      
      if (!sectionContent.trim()) {
        throw new Error('未找到相关的区块内容');
      }

      // 定义 Zod schema 用于结构化输出
      const QuestionsSchema = z.object({
        questions: z.array(z.string()).describe("生成的3个问题列表"),
        greet: z.string().describe("问候语")
      });

      type QuestionsType = z.infer<typeof QuestionsSchema>;

      const questionsPrompt = getQuestionsUserPrompt(siteDescription, sectionContent);

      const isGpt5 = this.configService.get('OPENAI_API_MODEL')?.includes('gpt-5');

      // 使用 zodResponseFormat 进行结构化输出
      const completion = await this.openai.chat.completions.parse({
        model: this.configService.get('OPENAI_API_MODEL_2') || 'gpt-4o-2024-08-06',
        messages: [
          {
            role: MessageRole.system,
            content: questionsSystemPrompt
          },
          {
            role: MessageRole.user,
            content: questionsPrompt
          }
        ],
        response_format: zodResponseFormat(QuestionsSchema as any, "questions_response"),
        ...(isGpt5 ? {
          verbosity: "low",
          reasoning_effort: "minimal"
        }:{})
      });

      const result = completion.choices[0]?.message?.parsed as QuestionsType;
      
      if (result && result.questions && result.greet) {
        return { list: result.questions, greet: result.greet };
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
          'What are the special features of this website?'
        ],
        greet: 'Hello! Welcome to our website! How can I help you?'
      };
    }
  }
}
