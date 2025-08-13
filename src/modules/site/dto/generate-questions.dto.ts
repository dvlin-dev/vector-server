import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateQuestionsDto {
  @ApiProperty({
    description: '网站内容，用于生成问题',
    example: '这是一个电商网站，主要销售电子产品，包括手机、笔记本电脑、平板电脑等。我们提供优质的产品和服务。'
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export interface GenerateQuestionsResponse {
  list: string[];
}
