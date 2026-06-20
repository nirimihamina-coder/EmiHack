import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SimulationScenario } from '../simulation-scenarios/simulation-scenario.entity';
import { Route } from '../routes/route.entity';

@Entity()
@Unique('uq_scenario_route', ['scenario', 'route'])
export class SimulationRouteConfig {
  @ApiProperty({ description: 'ID unique', example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ description: 'Scénario associé', type: () => SimulationScenario })
  @ManyToOne(() => SimulationScenario, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'scenario_id' })
  scenario!: SimulationScenario;

  @ApiProperty({ description: 'Route associée', type: () => Route })
  @ManyToOne(() => Route, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'route_id' })
  route!: Route;

  @ApiProperty({ description: 'Nombre de véhicules', example: 10 })
  @Column({ type: 'int', default: 10 })
  vehicleCount!: number;

  @ApiPropertyOptional({ description: 'Vitesse moyenne (km/h)', example: 60 })
  @Column({ type: 'int', nullable: true })
  avgSpeed?: number;

  @ApiProperty({ description: 'Date de création', example: '2026-06-21T00:00:00.000Z' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
