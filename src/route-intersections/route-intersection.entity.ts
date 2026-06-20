import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique, Check, Index, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Intersection } from '../intersections/intersection.entity';
import { Route } from '../routes/route.entity';

@Entity()
@Unique('uq_intersection_routes', ['intersection', 'route1', 'route2'])
@Check('chk_different_routes', '"route_id_1" <> "route_id_2"')
export class RouteIntersection {
  @ApiProperty({ description: 'ID unique', example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ description: 'Intersection', type: () => Intersection })
  @ManyToOne(() => Intersection, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'intersection_id' })
  intersection!: Intersection;

  @ApiProperty({ description: 'Première route', type: () => Route })
  @ManyToOne(() => Route, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'route_id_1' })
  route1!: Route;

  @ApiProperty({ description: 'Deuxième route', type: () => Route })
  @ManyToOne(() => Route, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'route_id_2' })
  route2!: Route;

  @ApiProperty({ description: 'Route prioritaire', type: () => Route })
  @ManyToOne(() => Route, { nullable: false })
  @JoinColumn({ name: 'priority_route_id' })
  priorityRoute!: Route;

  @ApiPropertyOptional({ description: 'Position (0-100%) sur route_1', example: 50.0 })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  positionOnRoute1?: number;

  @ApiPropertyOptional({ description: 'Position (0-100%) sur route_2', example: 50.0 })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  positionOnRoute2?: number;

  @ApiProperty({ description: 'Date de création', example: '2026-06-21T00:00:00.000Z' })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
