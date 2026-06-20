import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiProperty({ description: "Type d'incident", enum: ['accident', 'construction', 'road_work', 'obstacle'], example: 'accident' })
  @IsEnum(['accident', 'construction', 'road_work', 'obstacle'])
  type: string;

  @ApiProperty({ description: 'Sévérité', enum: ['low', 'medium', 'high', 'critical'], example: 'high' })
  @IsEnum(['low', 'medium', 'high', 'critical'])
  severity: string;

  @ApiPropertyOptional({ description: 'ID de la route associée', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsString()
  routeId?: string;

  @ApiPropertyOptional({ description: 'Latitude', example: -18.903 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: 47.522 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon?: number;

  @ApiPropertyOptional({ description: 'Position sur la route (0-100%)', example: 50.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  positionOnRoute?: number;

  @ApiProperty({ description: 'Description', example: 'Accident sur la RN1' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Nombre de voies bloquées', example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lanesBlocked?: number;

  @ApiPropertyOptional({ description: "ID de l'utilisateur", example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  reportedBy?: string;

  @ApiPropertyOptional({ description: 'Date de fin (prévisionnelle)', example: '2026-06-21T12:00:00.000Z' })
  @IsOptional()
  @IsString()
  endTime?: string;
}
