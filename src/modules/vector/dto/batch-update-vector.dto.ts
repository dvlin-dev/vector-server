import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateVectorDto } from './update-vector.dto';

export class BatchUpdateVectorDto {
  @ApiProperty({ 
    description: '批量更新向量数据列表', 
    type: [UpdateVectorDto],
    required: true 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateVectorDto)
  vectors: UpdateVectorDto[];
}
