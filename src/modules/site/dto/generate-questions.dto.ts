import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateQuestionsDto {
  @ApiProperty({
    description: '网站ID，用于获取网站信息',
    example: 'site-123'
  })
  @IsString()
  @IsNotEmpty()
  siteId: string;

  @ApiProperty({
    description: '区块ID，用于获取特定区块的向量数据',
    example: 'section-456'
  })
  @IsString()
  @IsNotEmpty()
  sectionId: string;
}

export interface GenerateQuestionsResponse {
  list: string[];
  greet: string;
}
