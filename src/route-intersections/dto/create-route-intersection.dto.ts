import { IsString, IsNotEmpty, IsUUID, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRouteIntersectionDto {
  @ApiProperty({ description: "ID de l'intersection", example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  intersectionId!: string;

  @ApiProperty({ description: 'ID de la première route', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  @IsNotEmpty()
  routeId1!: string;

  @ApiProperty({ description: 'ID de la deuxième route', example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID()
  @IsNotEmpty()
  routeId2!: string;

  @ApiProperty({ description: 'ID de la route prioritaire', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  @IsNotEmpty()
  priorityRouteId!: string;

  @ApiPropertyOptional({ description: 'Position (0-100%) sur route_1', example: 50.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  positionOnRoute1?: number;

  @ApiPropertyOptional({ description: 'Position (0-100%) sur route_2', example: 50.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  positionOnRoute2?: number;
}
