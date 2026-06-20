import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity()
@Index('idx_intersections_location', ['lat', 'lon'])
export class Intersection {
  @ApiProperty({ description: 'ID unique', example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiPropertyOptional({ description: "Nom de l'intersection", example: 'Carrefour Analakely' })
  @Column({ type: 'varchar', nullable: true })
  name?: string;

  @ApiProperty({ description: 'Latitude', example: -18.903 })
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat!: number;

  @ApiProperty({ description: 'Longitude', example: 47.522 })
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lon!: number;

  @ApiProperty({ description: "Type d'intersection", enum: ['roundabout', 'stop', 'priority', 'uncontrolled'], example: 'roundabout' })
  @Column({ type: 'varchar' })
  type!: string;

  @ApiProperty({ description: 'Date de création', example: '2026-06-21T00:00:00.000Z' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
