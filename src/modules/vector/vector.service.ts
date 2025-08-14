import { Inject, Injectable, LoggerService, forwardRef } from '@nestjs/common'
import { CreateVectorDto } from './dto/create-vector.dto'
import { SearchVectorDto } from './dto/search.dto'
import { getKeyConfigurationFromEnvironment } from '../../utils/llm/configuration'
import { KeyConfiguration } from 'src/types/keyConfiguration'
import { PrismaVectorStore } from 'langchain/vectorstores/prisma'
import { Prisma } from '@prisma/client'
import { PrismaService } from 'src/utils/prisma/prisma.service'
import { PrismaVectorService } from 'src/utils/prisma/prisma-vector.service'
import { UpdateVectorDto } from './dto/update-vector.dto'
import { ConfigService } from '@nestjs/config'
import { Document } from 'langchain/document'
import { getEmbeddings } from 'src/utils/llm/embeddings'
import { ListVectorsDto } from './dto/list-vectors.dto'
import { NormalizeDto } from './dto/normalize.dto'
import { ConversationService } from '../conversation/conversation.service'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { MessageRole } from '../conversation/dto/chat.dto'
import { BatchCreateVectorDto } from './dto/batch-create-vector.dto'
import { BatchUpdateVectorDto } from './dto/batch-update-vector.dto'
import { BatchDeleteVectorDto } from './dto/batch-delete-vector.dto'
import { getNormalizeUserPrompt, normalizeSystemPrompt } from 'src/utils/llm/prompt'

@Injectable()
export class VectorService {
  constructor(
    private prisma: PrismaService,
    private prismaVector: PrismaVectorService,
    private configService: ConfigService,
    @Inject(forwardRef(() => ConversationService))
    private conversationService: ConversationService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService
  ) {}
 
  get(id: string) {
    return this.prismaVector.index.findUnique({
      where: {
        id,
      },
    })
  }

  async update(updateVectorDto: UpdateVectorDto) {
    const { id, content, metadata, siteId, sectionId } = updateVectorDto
    const updateData: any = {}
    
    if (content !== undefined) updateData.content = content
    if (metadata !== undefined) updateData.metadata = metadata
    if (siteId !== undefined) updateData.siteId = siteId
    if (sectionId !== undefined) updateData.sectionId = sectionId

    await this.prismaVector.index.update({
      where: {
        id,
      },
      data: updateData,
    })

    // 只有当内容更新时才重新计算向量
    if (content !== undefined) {
      const keyConfiguration = getKeyConfigurationFromEnvironment(this.configService)
      const vector = await getEmbeddings(keyConfiguration).embedQuery(content)
      const vectorString = `[${vector.join(',')}]`
      await this.prismaVector.$executeRaw`
            UPDATE "Index"
            SET "vector" = ${vectorString}::vector
            WHERE "id" = ${id}
          `
    }

    return this.get(id)
  }

  delete(id: string) {
    return this.prismaVector.index.delete({
      where: {
        id,
      },
    })
  }

  async create(createVectorDto: CreateVectorDto) {
    const { content, metadata, siteId, sectionId } = createVectorDto

    const keyConfiguration = getKeyConfigurationFromEnvironment(this.configService)

    const createdVector = await this.prismaVector.index.create({
      data: {
        content,
        metadata,
        siteId,
        sectionId,
      },
    })

    const vector = await getEmbeddings(keyConfiguration).embedQuery(content)
    const vectorString = `[${vector.join(',')}]`

    await this.prismaVector.$executeRaw`
      UPDATE "Index"
      SET "vector" = ${vectorString}::vector
      WHERE "id" = ${createdVector.id}
    `

    return createdVector
  }

  async similaritySearch(searchVectorDto: SearchVectorDto) {
    const { message, size, siteId } = searchVectorDto

    // 构建 siteId 筛选的 SQL
    const filterSql = siteId ? Prisma.sql`WHERE "siteId" = ${siteId}` : undefined

    const docs = await this.customSimilaritySearchVectorWithScore(message, Number(size), filterSql)
    return docs
  }

  async customSimilaritySearchVectorWithScore(message: string, k: number, filterSql?: Prisma.Sql) {
    const vectorColumnRaw = Prisma.raw(`"vector"`)
    const tableNameRaw = Prisma.raw(`"Index"`)
    const columns = {
      id: PrismaVectorStore.IdColumn,
      content: PrismaVectorStore.ContentColumn,
      metadata: true,
      siteId: true,
      sectionId: true,
    }
    const entries = Object.entries(columns)

    const selectColumns = entries
      .map(([key, alias]) => (alias && key) || null)
      .filter((x): x is string => !!x)

    const selectRaw = Prisma.raw(selectColumns.map((x) => `"${x}"`).join(', '))
    const keyConfiguration = getKeyConfigurationFromEnvironment(this.configService)
    const query = await getEmbeddings(keyConfiguration).embedQuery(message)
    const vector = `[${query.join(',')}]`
    const querySql = Prisma.join(
      [
        Prisma.sql`
          SELECT ${selectRaw}, ${vectorColumnRaw} <=> ${vector}::vector as "_distance"
          FROM ${tableNameRaw}
        `,
        filterSql ? filterSql : null,
        Prisma.sql`
          ORDER BY "_distance" ASC
          LIMIT ${k};
        `,
      ].filter((x) => x != null),
      ''
    )
    const articles: any = await this.prismaVector.$queryRaw(querySql)

    const results = []
    for (const article of articles) {
      if (article._distance != null && article['content'] != null) {
        results.push(
          new Document({
            pageContent: article['content'],
            metadata: {
              ...article['metadata'],
              siteId: article['siteId'],
              sectionId: article['sectionId'],
              _distance: 1 - article._distance,
            },
          })
        )
      }
    }

    return results
  }

  async getVectorStore(keyConfiguration: KeyConfiguration): Promise<any> {
    // TODO: fix any
    return PrismaVectorStore.withModel<any>(this.prismaVector).create(
      getEmbeddings(keyConfiguration),
      {
        prisma: Prisma,
        tableName: 'Index' as any,
        vectorColumnName: 'vector',
        columns: {
          id: PrismaVectorStore.IdColumn,
          content: PrismaVectorStore.ContentColumn,
          metadata: true,
          siteId: true,
          sectionId: true,
        },
      }
    )
  }

  async list(listVectorsDto: ListVectorsDto) {
    const { page = 1, pageSize = 10, siteId, sectionId } = listVectorsDto
    const skip = (page - 1) * pageSize

    // 构建查询条件
    const where: any = {}
    if (siteId) {
      where.siteId = siteId
    }
    if (sectionId) {
      where.sectionId = sectionId
    }

    const [items, total] = await Promise.all([
      this.prismaVector.index.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prismaVector.index.count({ where }),
    ])

    return {
      items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }



  async normalize(normalizeDto: NormalizeDto): Promise<Array<{ content: string | null; sectionId: string }>> {
    const { webInfo, list } = normalizeDto
    
    // 创建并发请求的 Promise 数组
    const promises = list.map(async (section) => {
      const request = {
        model: this.configService.get('OPENAI_API_MODEL') || 'gpt-4o',
        messages: [
          {
            role: MessageRole.system,
            content: normalizeSystemPrompt,
          },
          {
            role: MessageRole.user,
            content: getNormalizeUserPrompt(webInfo, section.sectionInfo),
          },
        ],
        temperature: 0.6,
      }

      try {
        const content = await this.conversationService.completions(request)
        return {
          content,
          sectionId: section.sectionId,
        }
      } catch (error) {
        this.logger.error(`Failed to normalize section ${section.sectionId}:`, error)
        return {
          content: null,
          sectionId: section.sectionId,
        }
      }
    })

    // 等待所有请求完成
    return Promise.all(promises)
  }

  async batchCreate(batchCreateVectorDto: BatchCreateVectorDto) {
    const { vectors } = batchCreateVectorDto
    const keyConfiguration = getKeyConfigurationFromEnvironment(this.configService)
    
    try {
      // 并行创建所有向量记录
      const createdVectors = await Promise.all(
        vectors.map(async (vectorDto) => {
          const { content, metadata, siteId, sectionId } = vectorDto
          
          return this.prismaVector.index.create({
            data: {
              content,
              metadata,
              siteId,
              sectionId,
            },
          })
        })
      )

      // 并行计算并更新所有向量的嵌入
      await Promise.all(
        createdVectors.map(async (createdVector, index) => {
          const vector = await getEmbeddings(keyConfiguration).embedQuery(vectors[index].content)
          const vectorString = `[${vector.join(',')}]`
          
          await this.prismaVector.$executeRaw`
            UPDATE "Index"
            SET "vector" = ${vectorString}::vector
            WHERE "id" = ${createdVector.id}
          `
        })
      )

      return {
        success: true,
        created: createdVectors.length,
        data: createdVectors,
      }
    } catch (error) {
      this.logger.error('批量创建向量失败:', error)
      throw error
    }
  }

  async batchUpdate(batchUpdateVectorDto: BatchUpdateVectorDto) {
    const { vectors } = batchUpdateVectorDto
    const keyConfiguration = getKeyConfigurationFromEnvironment(this.configService)
    
    try {
      const updateResults = await Promise.all(
        vectors.map(async (vectorDto) => {
          const { id, content, metadata, siteId, sectionId } = vectorDto
          const updateData: any = {}
          
          if (content !== undefined) updateData.content = content
          if (metadata !== undefined) updateData.metadata = metadata
          if (siteId !== undefined) updateData.siteId = siteId
          if (sectionId !== undefined) updateData.sectionId = sectionId

          // 更新基本信息
          const updatedVector = await this.prismaVector.index.update({
            where: { id },
            data: updateData,
          })

          // 只有当内容更新时才重新计算向量
          if (content !== undefined) {
            const vector = await getEmbeddings(keyConfiguration).embedQuery(content)
            const vectorString = `[${vector.join(',')}]`
            await this.prismaVector.$executeRaw`
              UPDATE "Index"
              SET "vector" = ${vectorString}::vector
              WHERE "id" = ${id}
            `
          }

          return updatedVector
        })
      )

      return {
        success: true,
        updated: updateResults.length,
        data: updateResults,
      }
    } catch (error) {
      this.logger.error('批量更新向量失败:', error)
      throw error
    }
  }

  async batchDelete(batchDeleteVectorDto: BatchDeleteVectorDto) {
    const { ids } = batchDeleteVectorDto
    
    try {
      // 并行删除所有向量
      const deleteResults = await Promise.all(
        ids.map(async (id) => {
          return this.prismaVector.index.delete({
            where: { id },
          })
        })
      )

      return {
        success: true,
        deleted: deleteResults.length,
        data: deleteResults,
      }
    } catch (error) {
      this.logger.error('批量删除向量失败:', error)
      throw error
    }
  }
}