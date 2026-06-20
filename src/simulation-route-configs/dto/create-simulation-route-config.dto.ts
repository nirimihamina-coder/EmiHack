import { IsString, IsNotEmpty, IsUUID, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSimulationRouteConfigDto {
  @ApiProperty({ description: 'ID du scénario', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  scenarioId!: string;

  @ApiProperty({ description: 'ID de la route', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  @IsNotEmpty()
  routeId!: string;

  @ApiPropertyOptional({ description: 'Nombre de véhicules', example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  vehicleCount?: number;

  @ApiPropertyOptional({ description: 'Vitesse moyenne (km/h)', example: 60 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  avgSpeed?: number;
}
