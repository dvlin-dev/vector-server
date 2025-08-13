import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

// 定义 MessageRole 枚举
export enum MessageRole {
  system = 'system',
  assistant = 'assistant',
  user = 'user',
}

export class MessageDto {
  @ApiProperty({ description: 'message content', required: true })
  @IsNotEmpty()
  @IsString()
  content: string

  @ApiProperty({ description: 'role', required: true })
  @IsString()
  role: MessageRole
}

export class CompletionsDto {
  @ApiProperty({ description: 'messages', required: true, type: [MessageDto] })
  @IsNotEmpty()
  messages: MessageDto[]

  @ApiProperty({ description: '会话ID', required: true })
  @IsNotEmpty()
  @IsString()
  conversationId: string
}


export class CompletionsRegularDto {
  @ApiProperty({ description: 'messages', required: true, type: [MessageDto] })
  @IsNotEmpty()
  messages: MessageDto[]

  @ApiProperty({ description: 'model', required: true, default: 'moonshotai/kimi-k2-instruct'})
  @IsOptional()
  @IsString()
  model: string

  @ApiProperty({ description: 'temperature', required: true, default: 0.7 })
  @IsNotEmpty()
  @IsNumber()
  temperature: number
}