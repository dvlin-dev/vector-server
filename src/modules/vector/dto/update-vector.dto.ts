import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateVectorDto {
  @ApiProperty({ description: 'id', required: true })
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: '内容', required: false })
  @IsOptional()
  content?: string;

  @ApiProperty({ description: '元数据', required: false })
  @IsOptional()
  metadata?: any;

  @ApiProperty({ description: 'siteId', required: false })
  @IsString()
  @IsOptional()
  siteId?: string;

  @ApiProperty({ description: 'sectionId', required: false })
  @IsString()
  @IsOptional()
  sectionId?: string;
}
