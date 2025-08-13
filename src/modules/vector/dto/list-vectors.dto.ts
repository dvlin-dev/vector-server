import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString } from 'class-validator'
import { Type } from 'class-transformer'

export class ListVectorsDto {
  @ApiProperty({ description: '页码', default: 1 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1

  @ApiProperty({ description: '每页数量', default: 10 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 10

  @ApiProperty({ description: '网站ID，用于筛选特定网站的向量数据', required: false })
  @IsString()
  @IsOptional()
  siteId?: string

  @ApiProperty({ description: '网站区块ID，用于筛选特定网站的向量数据', required: false })
  @IsString()
  @IsOptional()
  sectionId?: string
}
