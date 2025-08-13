import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery
} from '@nestjs/swagger';
import { SiteService } from './site.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto, TicketStatus } from './dto/update-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { SummarizeSiteDto } from './dto/summarize-site.dto';
import { GenerateQuestionsDto, GenerateQuestionsResponse } from './dto/generate-questions.dto';

@ApiTags('站点管理')
@Controller('site')
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  // Site 相关接口
  @Post()
  @ApiOperation({ summary: '创建站点' })
  @ApiResponse({ status: 201, description: '站点创建成功' })
  @ApiResponse({ status: 409, description: '站点ID已存在' })
  createSite(@Body() createSiteDto: CreateSiteDto) {
    return this.siteService.createSite(createSiteDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有站点' })
  @ApiResponse({ status: 200, description: '获取站点列表成功' })
  findAllSites() {
    return this.siteService.findAllSites();
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取站点详情' })
  @ApiParam({ name: 'id', description: '站点UUID' })
  @ApiResponse({ status: 200, description: '获取站点详情成功' })
  @ApiResponse({ status: 404, description: '站点不存在' })
  findOneSite(@Param('id') id: string) {
    return this.siteService.findOneSite(id);
  }

  @Get('external/:siteId')
  @ApiOperation({ summary: '根据外部平台ID获取站点详情' })
  @ApiParam({ name: 'siteId', description: '外部平台站点ID' })
  @ApiResponse({ status: 200, description: '获取站点详情成功' })
  @ApiResponse({ status: 404, description: '站点不存在' })
  findSiteBySiteId(@Param('siteId') siteId: string) {
    return this.siteService.findSiteBySiteId(siteId);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新站点信息' })
  @ApiParam({ name: 'id', description: '站点UUID' })
  @ApiResponse({ status: 200, description: '站点更新成功' })
  @ApiResponse({ status: 404, description: '站点不存在' })
  @ApiResponse({ status: 409, description: '站点ID已存在' })
  updateSite(@Param('id') id: string, @Body() updateSiteDto: UpdateSiteDto) {
    return this.siteService.updateSite(id, updateSiteDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除站点' })
  @ApiParam({ name: 'id', description: '站点UUID' })
  @ApiResponse({ status: 200, description: '站点删除成功' })
  @ApiResponse({ status: 404, description: '站点不存在' })
  @HttpCode(HttpStatus.OK)
  removeSite(@Param('id') id: string) {
    return this.siteService.removeSite(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: '获取站点统计信息' })
  @ApiParam({ name: 'id', description: '站点UUID' })
  @ApiResponse({ status: 200, description: '获取统计信息成功' })
  @ApiResponse({ status: 404, description: '站点不存在' })
  getSiteStats(@Param('id') id: string) {
    return this.siteService.getSiteStats(id);
  }

  @Post('summarize')
  @ApiOperation({ summary: '总结并更新站点描述' })
  @ApiResponse({ status: 200, description: '站点描述总结成功' })
  @ApiResponse({ status: 404, description: '站点不存在' })
  @ApiResponse({ status: 500, description: 'AI总结生成失败' })
  summarizeAndUpdateDescription(@Body() summarizeSiteDto: SummarizeSiteDto) {
    return this.siteService.summarizeAndUpdateSiteDescription(summarizeSiteDto);
  }

  @Post('generate-questions')
  @ApiOperation({ summary: '生成访问网站时可能想问的问题' })
  @ApiResponse({ 
    status: 200, 
    description: '问题生成成功',
    schema: {
      type: 'object',
      properties: {
        list: {
          type: 'array',
          items: {
            type: 'string'
          },
          minItems: 3,
          maxItems: 3,
          example: [
            '这个网站的主要功能是什么？',
            '如何注册和使用该平台的服务？',
            '网站提供哪些特色功能或优势？'
          ]
        }
      }
    }
  })
  @ApiResponse({ status: 500, description: 'AI问题生成失败' })
  generateQuestions(@Body() generateQuestionsDto: GenerateQuestionsDto): Promise<GenerateQuestionsResponse> {
    return this.siteService.generateQuestions(generateQuestionsDto);
  }

  // Ticket 相关接口
  @Post('ticket')
  @ApiOperation({ summary: '创建工单' })
  @ApiResponse({ status: 201, description: '工单创建成功' })
  @ApiResponse({ status: 404, description: '关联的站点不存在' })
  createTicket(@Body() createTicketDto: CreateTicketDto) {
    return this.siteService.createTicket(createTicketDto);
  }

  @Get('ticket/list')
  @ApiOperation({ summary: '获取工单列表' })
  @ApiResponse({ status: 200, description: '获取工单列表成功' })
  findAllTickets(@Query() query: ListTicketsDto) {
    return this.siteService.findAllTickets(query.siteId, query.status);
  }

  @Get('ticket/:id')
  @ApiOperation({ summary: '获取工单详情' })
  @ApiParam({ name: 'id', description: '工单UUID' })
  @ApiResponse({ status: 200, description: '获取工单详情成功' })
  @ApiResponse({ status: 404, description: '工单不存在' })
  findOneTicket(@Param('id') id: string) {
    return this.siteService.findOneTicket(id);
  }

  @Patch('ticket/:id')
  @ApiOperation({ summary: '更新工单状态' })
  @ApiParam({ name: 'id', description: '工单UUID' })
  @ApiResponse({ status: 200, description: '工单更新成功' })
  @ApiResponse({ status: 404, description: '工单不存在' })
  updateTicket(@Param('id') id: string, @Body() updateTicketDto: UpdateTicketDto) {
    return this.siteService.updateTicket(id, updateTicketDto);
  }

  @Delete('ticket/:id')
  @ApiOperation({ summary: '删除工单' })
  @ApiParam({ name: 'id', description: '工单UUID' })
  @ApiResponse({ status: 200, description: '工单删除成功' })
  @ApiResponse({ status: 404, description: '工单不存在' })
  @HttpCode(HttpStatus.OK)
  removeTicket(@Param('id') id: string) {
    return this.siteService.removeTicket(id);
  }
}
