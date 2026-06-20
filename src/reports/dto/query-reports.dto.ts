import { IsOptional, IsEnum, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryReportsDto {
  @ApiPropertyOptional({ description: 'Latitude pour la recherche de proximité', example: -18.8792 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude pour la recherche de proximité', example: 47.5079 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;

  @ApiPropertyOptional({ description: 'Rayon de recherche en mètres', example: 5000 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  radius?: number;

  @ApiPropertyOptional({ description: 'Filtrer par type', enum: ['accident', 'construction', 'road_work', 'obstacle'] })
  @IsOptional()
  @IsEnum(['accident', 'construction', 'road_work', 'obstacle'])
  type?: string;

  @ApiPropertyOptional({ description: 'Filtrer par sévérité', enum: ['low', 'medium', 'high', 'critical'] })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  severity?: string;

  @ApiPropertyOptional({ description: 'Nombre maximum de résultats', example: 50 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}
