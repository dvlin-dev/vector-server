import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Inject,
  LoggerService,
  Param,
  Patch,
  Post,
  Query,


  UseInterceptors,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { VectorService } from './vector.service'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { CreateVectorDto } from './dto/create-vector.dto'

import { SearchVectorDto } from './dto/search.dto'
import { UpdateVectorDto } from './dto/update-vector.dto'

import { ListVectorsDto } from './dto/list-vectors.dto'
import { NormalizeDto } from './dto/normalize.dto'
import { BatchCreateVectorDto } from './dto/batch-create-vector.dto'
import { BatchUpdateVectorDto } from './dto/batch-update-vector.dto'
import { BatchDeleteVectorDto } from './dto/batch-delete-vector.dto'

@ApiTags('向量')
@UseInterceptors(ClassSerializerInterceptor)
@Controller('vector')
export class VectorController {
  constructor(
    private vectorService: VectorService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService
  ) {}

  @ApiOperation({ summary: '获取向量详情' })
  @ApiResponse({ status: 200, description: '成功获取向量详情' })
  @Get(':id/detail')
  get(@Param('id') id: string) {
    return this.vectorService.get(id)
  }

  @ApiOperation({ summary: '添加向量数据' })
  @Post()
  create(@Body() createVectorDto: CreateVectorDto) {
    return this.vectorService.create(createVectorDto)
  }

  @ApiOperation({ summary: '更新向量信息' })
  @Patch('')
  update(@Body() updateVectorDto: UpdateVectorDto) {
    return this.vectorService.update(updateVectorDto)
  }

  @ApiOperation({ summary: '删除向量' })
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.vectorService.delete(id)
  }

  @ApiOperation({ summary: '相似度搜索' })
  @ApiResponse({ status: 200, description: '成功获取' })
  @Get('similarity_search')
  async similaritySearch(@Query() searchVectorDto: SearchVectorDto) {
    return this.vectorService.similaritySearch(searchVectorDto)
  }

  @ApiOperation({ summary: '获取当前网站下所有的向量数据列表' })
  @ApiResponse({ status: 200, description: '成功获取向量列表，支持通过siteId和sectionId筛选特定网站的数据' })
  @Get('list')
  async list(@Query() listVectorsDto: ListVectorsDto) {
    return this.vectorService.list(listVectorsDto)
  }

  @ApiOperation({ summary: '标准化区块信息' })
  @ApiResponse({ status: 200, description: '成功标准化信息' })
  @Post('normalize')
  async normalize(@Body() normalizeDto: NormalizeDto): Promise<Array<{ content: string | null; sectionId: string }>> {
    return this.vectorService.normalize(normalizeDto)
  }

  @ApiOperation({ summary: '批量添加向量数据' })
  @ApiResponse({ status: 200, description: '成功批量创建向量' })
  @Post('batch')
  async batchCreate(@Body() batchCreateVectorDto: BatchCreateVectorDto) {
    return this.vectorService.batchCreate(batchCreateVectorDto)
  }

  @ApiOperation({ summary: '批量更新向量信息' })
  @ApiResponse({ status: 200, description: '成功批量更新向量' })
  @Patch('batch')
  async batchUpdate(@Body() batchUpdateVectorDto: BatchUpdateVectorDto) {
    return this.vectorService.batchUpdate(batchUpdateVectorDto)
  }

  @ApiOperation({ summary: '批量删除向量' })
  @ApiResponse({ status: 200, description: '成功批量删除向量' })
  @Delete('batch')
  async batchDelete(@Body() batchDeleteVectorDto: BatchDeleteVectorDto) {
    return this.vectorService.batchDelete(batchDeleteVectorDto)
  }
}
