import { ApiProperty } from '@nestjs/swagger';
import { Message } from '@prisma/client';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateConversationDto {
  @ApiProperty({ description: 'id', required: true })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'messages', required: false })
  @IsArray()
  message: Message;

  @ApiProperty({ description: 'siteId', required: false })
  @IsString()
  @IsOptional()
  siteId?: string;
}
