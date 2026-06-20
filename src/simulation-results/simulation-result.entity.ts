import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SimulationScenario } from '../simulation-scenarios/simulation-scenario.entity';

@Entity()
@Index('idx_simulation_results_scenario', ['scenario'])
export class SimulationResult {
  @ApiProperty({ description: 'ID unique', example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiPropertyOptional({ description: 'Scénario associé', type: () => SimulationScenario })
  @ManyToOne(() => SimulationScenario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'scenario_id' })
  scenario?: SimulationScenario;

  @ApiPropertyOptional({ description: 'Temps de trajet moyen (secondes)', example: 1200.50 })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  avgTravelTime?: number;

  @ApiPropertyOptional({ description: 'Niveau max de congestion (0-100%)', example: 85.5 })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  maxCongestionLevel?: number;

  @ApiPropertyOptional({ description: 'Nombre total de véhicules', example: 150 })
  @Column({ type: 'int', nullable: true })
  totalVehicles?: number;

  @ApiPropertyOptional({ description: 'Points noirs (bottlenecks)', example: [{ lat: -18.903, lon: 47.522, reason: 'Carrefour saturé' }] })
  @Column({ type: 'jsonb', nullable: true })
  bottlenecks?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'Suggestions (feux, giratoires, etc.)', example: [{ type: 'traffic_light', description: 'Installer un feu au carrefour Analakely' }] })
  @Column({ type: 'jsonb', nullable: true })
  suggestions?: Record<string, unknown>[];

  @ApiProperty({ description: 'Date de création', example: '2026-06-21T00:00:00.000Z' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
