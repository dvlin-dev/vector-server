import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum TicketStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED'
}

export class ListTicketsDto {
  @ApiPropertyOptional({
    description: '站点ID，用于过滤特定站点的工单',
    example: 'site-123'
  })
  @IsString()
  @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({
    description: '工单状态，用于过滤特定状态的工单',
    enum: TicketStatus,
    example: TicketStatus.PENDING
  })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;
}
