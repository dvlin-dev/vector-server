import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSiteDto {
  @ApiProperty({
    description: '外部平台的站点ID',
    example: 'external-site-123'
  })
  @IsString()
  @IsNotEmpty()
  siteId: string;

  @ApiPropertyOptional({
    description: '站点描述',
    example: '这是一个第三方平台站点'
  })
  @IsString()
  @IsOptional()
  description?: string;
}
