import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class BatchDeleteVectorDto {
  @ApiProperty({ 
    description: '要删除的向量ID列表', 
    type: [String],
    required: true 
  })
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
