import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsOptional } from 'class-validator'
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
}
