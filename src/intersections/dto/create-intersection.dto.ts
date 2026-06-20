import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIntersectionDto {
  @ApiPropertyOptional({ description: "Nom de l'intersection", example: 'Carrefour Analakely' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Latitude', example: -18.903 })
  @IsNumber()
  lat!: number;

  @ApiProperty({ description: 'Longitude', example: 47.522 })
  @IsNumber()
  lon!: number;

  @ApiProperty({ description: "Type d'intersection", enum: ['roundabout', 'stop', 'priority', 'uncontrolled'], example: 'roundabout' })
  @IsEnum(['roundabout', 'stop', 'priority', 'uncontrolled'])
  type!: string;
}
