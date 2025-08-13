import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

export class CreateConversationDto {
  @ApiProperty({ description: 'abstract', required: false })
  @IsString()
  @IsOptional()
  abstract?: string

  @ApiProperty({ description: 'siteId', required: false })
  @IsString()
  @IsOptional()
  siteId?: string
}
