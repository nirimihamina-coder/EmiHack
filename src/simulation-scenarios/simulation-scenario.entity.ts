import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity()
export class SimulationScenario {
  @ApiProperty({ description: 'ID unique', example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ description: 'Nom du scénario', example: 'Heure de pointe matinale' })
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @ApiPropertyOptional({ description: 'Description', example: 'Simulation du trafic entre 7h et 9h' })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: "Densité de véhicules", enum: ['low', 'medium', 'high'], example: 'medium' })
  @Column({ type: 'varchar', length: 20, default: 'medium' })
  vehicleDensity!: string;

  @ApiProperty({ description: "Période de la journée", enum: ['morning', 'afternoon', 'evening', 'night'], example: 'afternoon' })
  @Column({ type: 'varchar', length: 20, default: 'afternoon' })
  timeOfDay!: string;

  @ApiProperty({ description: 'Date de création', example: '2026-06-21T00:00:00.000Z' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
