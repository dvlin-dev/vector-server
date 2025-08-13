import { Injectable, NotFoundException, ConflictException, Inject, LoggerService } from '@nestjs/common';
import { PrismaService } from '../../utils/prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { SummarizeSiteDto } from './dto/summarize-site.dto';
import { ConversationService } from '../conversation/conversation.service';
import { MessageRole } from '../conversation/dto/chat.dto';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class SiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationService: ConversationService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService
  ) {}

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

  async findAllTickets(siteId?: string) {
    const where = siteId ? { siteId } : {};
    
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
}
