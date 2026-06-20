import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Route } from '../../routes/route.entity';

@Entity()
@Index(['status', 'startTime'])
export class Report {
  @ApiProperty({ description: 'ID unique', example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ description: "Type d'incident", enum: ['accident', 'construction', 'road_work', 'obstacle'], example: 'accident' })
  @Column({ type: 'varchar', length: 50 })
  type!: string;

  @ApiProperty({ description: 'Niveau de sévérité', enum: ['low', 'medium', 'high', 'critical'], example: 'high' })
  @Column({ type: 'varchar', length: 20 })
  severity!: string;

  @ApiPropertyOptional({ description: 'Route associée', type: () => Route })
  @ManyToOne(() => Route, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'route_id' })
  route?: Route;

  @ApiPropertyOptional({ description: 'Latitude', example: -18.903 })
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: 47.522 })
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lon?: number;

  @ApiPropertyOptional({ description: 'Position sur la route (0-100%)', example: 50.0 })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  positionOnRoute?: number;

  @ApiProperty({ description: 'Description', example: 'Accident sur la RN1 au niveau du carrefour' })
  @Column({ type: 'text' })
  description!: string;

  @ApiProperty({ description: 'Nombre de voies bloquées', example: 2 })
  @Column({ type: 'int', default: 0 })
  lanesBlocked!: number;

  @ApiPropertyOptional({ description: "ID de l'utilisateur qui a signalé", example: '550e8400-e29b-41d4-a716-446655440000' })
  @Column({ nullable: true })
  reportedBy?: string;

  @ApiProperty({ description: 'Date de début', example: '2026-06-21T10:00:00.000Z' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startTime!: Date;

  @ApiPropertyOptional({ description: 'Date de fin', example: '2026-06-21T12:00:00.000Z' })
  @Column({ type: 'timestamp', nullable: true })
  endTime?: Date;

  @ApiProperty({ description: 'Statut', enum: ['active', 'resolved'], example: 'active' })
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @ApiProperty({ description: 'Date de création', example: '2026-06-21T10:00:00.000Z' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
