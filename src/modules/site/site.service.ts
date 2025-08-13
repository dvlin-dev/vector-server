import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../utils/prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

@Injectable()
export class SiteService {
  constructor(private readonly prisma: PrismaService) {}

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
}
