import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  MaxLength,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LocationDto {
  @ApiProperty({ description: 'Latitude', example: -18.8792 })
  @IsNumber()
  @Min(-19.05)
  @Max(-18.75)
  lat: number;

  @ApiProperty({ description: 'Longitude', example: 47.5079 })
  @IsNumber()
  @Min(47.35)
  @Max(47.65)
  lng: number;

  @ApiPropertyOptional({ description: 'Adresse', example: "Avenue de l'Indépendance" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Quartier', example: 'Antaninarenina' })
  @IsOptional()
  @IsString()
  neighborhood?: string;
}

export class CreateReportDto {
  @ApiProperty({ description: 'Type de signalement', enum: ['traffic_jam', 'road_blocked', 'flood', 'accident', 'transport_issue'], example: 'traffic_jam' })
  @IsEnum(['traffic_jam', 'road_blocked', 'flood', 'accident', 'transport_issue'])
  type: string;

  @ApiProperty({ description: 'Sévérité', enum: ['low', 'medium', 'high', 'critical'], example: 'high' })
  @IsEnum(['low', 'medium', 'high', 'critical'])
  severity: string;

  @ApiProperty({ description: 'Localisation', type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiProperty({ description: 'Description du problème', example: 'Embouteillage sur la RN1 en direction du centre-ville' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @ApiProperty({ description: "ID de l'utilisateur", example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  createdBy: string;

  @ApiPropertyOptional({ description: 'ID de la route associée', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  routeId?: string;

  @ApiPropertyOptional({ description: 'Photos (URLs)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
