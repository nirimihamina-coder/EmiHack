import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSimulationScenarioDto {
  @ApiProperty({ description: 'Nom du scénario', example: 'Heure de pointe matinale' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Description', example: 'Simulation du trafic entre 7h et 9h' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: "Densité de véhicules", enum: ['low', 'medium', 'high'], example: 'medium' })
  @IsEnum(['low', 'medium', 'high'])
  vehicleDensity!: string;

  @ApiProperty({ description: "Période de la journée", enum: ['morning', 'afternoon', 'evening', 'night'], example: 'afternoon' })
  @IsEnum(['morning', 'afternoon', 'evening', 'night'])
  timeOfDay!: string;
}
