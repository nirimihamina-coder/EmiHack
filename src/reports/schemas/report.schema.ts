import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity()
@Index(['status', 'expiresAt'])
export class Report {
  @ApiProperty({ description: 'ID unique', example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ description: 'Type de problème', enum: ['traffic_jam', 'road_blocked', 'flood', 'accident', 'transport_issue'], example: 'traffic_jam' })
  @Column({ type: 'varchar' })
  type!: string;

  @ApiProperty({ description: 'Niveau de sévérité', enum: ['low', 'medium', 'high', 'critical'], example: 'high' })
  @Column({ type: 'varchar' })
  severity!: string;

  @ApiProperty({ description: 'Coordonnées et adresse' })
  @Column({ type: 'jsonb' })
  location!: {
    lat: number;
    lng: number;
    address?: string;
    neighborhood?: string;
  };

  @ApiProperty({ description: 'Description du problème', example: 'Embouteillage sur la RN1' })
  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @ApiProperty({ description: "ID de l'utilisateur créateur", example: '507f1f77bcf86cd799439011' })
  @Column()
  createdBy!: string;

  @ApiProperty({ description: 'Nombre de votes positifs', example: 12 })
  @Column({ default: 0 })
  upvotes!: number;

  @ApiProperty({ description: 'Nombre de votes négatifs', example: 2 })
  @Column({ default: 0 })
  downvotes!: number;

  @ApiProperty({ description: 'Statut', enum: ['active', 'resolved', 'expired'], example: 'active' })
  @Column({ default: 'active' })
  status!: string;

  @ApiPropertyOptional({ description: 'URLs des photos', type: [String] })
  @Column('text', { array: true, default: '{}' })
  photos!: string[];

  @ApiProperty({ description: "Date d'expiration", example: '2026-06-20T17:39:00.000Z' })
  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @ApiProperty({ description: 'Date de création', example: '2026-06-20T15:39:00.000Z' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @ApiProperty({ description: 'Date de mise à jour', example: '2026-06-20T15:39:00.000Z' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
