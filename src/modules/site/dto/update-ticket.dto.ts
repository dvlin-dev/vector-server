import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum TicketStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED'
}

export class UpdateTicketDto {
  @ApiPropertyOptional({
    description: '工单状态',
    enum: TicketStatus,
    example: TicketStatus.PROCESSED
  })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;
}
