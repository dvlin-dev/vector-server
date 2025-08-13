import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({
    description: '工单内容',
    example: '用户反馈页面加载慢的问题'
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: '访客邮箱',
    example: 'user@example.com'
  })
  @IsEmail()
  @IsNotEmpty()
  visitorEmail: string;

  @ApiProperty({
    description: '关联的站点ID',
    example: 'uuid-site-id'
  })
  @IsString()
  @IsNotEmpty()
  siteId: string;
}
