import { IsString, IsOptional, IsUUID, IsNumber, IsArray, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSimulationResultDto {
  @ApiPropertyOptional({ description: 'ID du scénario', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  scenarioId?: string;

  @ApiPropertyOptional({ description: 'Temps de trajet moyen (secondes)', example: 1200.50 })
  @IsOptional()
  @IsNumber()
  avgTravelTime?: number;

  @ApiPropertyOptional({ description: 'Niveau max de congestion (0-100%)', example: 85.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCongestionLevel?: number;

  @ApiPropertyOptional({ description: 'Nombre total de véhicules', example: 150 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalVehicles?: number;

  @ApiPropertyOptional({ description: 'Points noirs', example: [{ lat: -18.903, lon: 47.522, reason: 'Carrefour saturé' }] })
  @IsOptional()
  @IsArray()
  bottlenecks?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'Suggestions', example: [{ type: 'traffic_light', description: 'Installer un feu' }] })
  @IsOptional()
  @IsArray()
  suggestions?: Record<string, unknown>[];
}
