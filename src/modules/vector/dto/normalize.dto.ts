import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SectionDto {
  @ApiProperty({ description: '章节信息', required: true })
  @IsString()
  @IsNotEmpty()
  sectionInfo: string;

  @ApiProperty({ description: '章节ID', required: true })
  @IsString()
  @IsNotEmpty()
  sectionId: string;
}

export class NormalizeDto {
  @ApiProperty({ description: '网页信息', required: true })
  @IsString()
  @IsNotEmpty()
  webInfo: string;

  @ApiProperty({ 
    description: '章节列表', 
    required: true,
    type: [SectionDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionDto)
  list: SectionDto[];
}
