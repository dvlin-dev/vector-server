import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateVectorDto {
  @ApiProperty({ description: '内容', required: true })
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: '元数据', required: false })
  @IsOptional()
  metadata?: any;

  @ApiProperty({ description: 'siteId', required: true })
  @IsString()
  siteId: string;

  @ApiProperty({ description: 'sectionId', required: false })
  @IsString()
  @IsOptional()
  sectionId?: string;
}
