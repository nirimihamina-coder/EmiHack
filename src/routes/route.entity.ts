import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class Route {
  @ApiProperty({ description: 'ID unique', example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ description: 'Nom de la route', example: 'Route RN1 - Tana vers Itasy' })
  @Column({ type: 'varchar' })
  name!: string;

  @ApiProperty({ description: 'Type de route', example: 'RN 7' })
  @Column({ type: 'varchar' })
  type!: string;

  @ApiProperty({ description: 'Tableau de points [lat, lng]', example: [[-18.8792, 47.5079], [-18.895, 47.521]] })
  @Column({ type: 'jsonb' })
  coordinates!: number[][];

  @ApiProperty({ description: 'Distance totale en km', example: 15.3 })
  @Column({ type: 'float' })
  distance!: number;

  @ApiProperty({ description: 'Durée estimée en minutes', example: 35 })
  @Column({ type: 'float' })
  duration!: number;

  @ApiProperty({ description: 'Date de création', example: '2026-06-20T15:39:00.000Z' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
