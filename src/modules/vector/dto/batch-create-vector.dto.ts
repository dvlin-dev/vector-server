import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateVectorDto } from './create-vector.dto';

export class BatchCreateVectorDto {
  @ApiProperty({ 
    description: '批量创建向量数据列表', 
    type: [CreateVectorDto],
    required: true 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVectorDto)
  vectors: CreateVectorDto[];
}
