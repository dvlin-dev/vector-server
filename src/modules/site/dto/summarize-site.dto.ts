import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SummarizeSiteDto {
  @ApiProperty({
    description: '站点ID',
    example: 'external-site-123'
  })
  @IsString()
  @IsNotEmpty()
  siteId: string;

  @ApiProperty({
    description: '用于AI总结的内容',
    example: '这是一个电商网站，主要销售电子产品，包括手机、电脑、家电等。网站提供在线购买、配送服务。'
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
