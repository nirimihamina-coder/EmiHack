import {
  IsString, IsNotEmpty, IsNumber, IsArray, ArrayMinSize, Validate,
  ValidatorConstraint, ValidatorConstraintInterface, IsOptional, IsEnum, Min, Allow,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'isCoordinateArray', async: false })
class IsCoordinateArrayConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!Array.isArray(value)) return false;
    return value.every(
      (coord) =>
        Array.isArray(coord) &&
        coord.length === 2 &&
        typeof coord[0] === 'number' && !isNaN(coord[0]) &&
        typeof coord[1] === 'number' && !isNaN(coord[1]),
    );
  }

  defaultMessage(): string {
    return 'coordinates must be an array of [lat, lng] pairs';
  }
}

export class CreateRouteDto {
  @ApiProperty({ description: 'Nom de la route', example: 'Route RN1 - Tana vers Itasy' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Type de route', example: 'RN 7' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({
    description: 'Tableau de points [lat, lng]',
    example: [[-18.8792, 47.5079], [-18.895, 47.521]],
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  @IsArray()
  @ArrayMinSize(2)
  @Validate(IsCoordinateArrayConstraint)
  coordinates!: number[][];

  @ApiProperty({ description: 'Distance totale en km', example: 15.3 })
  @IsNumber()
  distance!: number;

  @ApiProperty({ description: 'Durée estimée en minutes', example: 35 })
  @IsNumber()
  duration!: number;

  @ApiProperty({ description: 'Nombre de voies', example: 2 })
  @Allow()
  @IsOptional()
  @IsNumber()
  @Min(1)
  lanes?: number;

  @ApiProperty({ description: 'Limite de vitesse (km/h)', example: 50 })
  @Allow()
  @IsOptional()
  @IsNumber()
  @Min(0)
  speedLimit?: number;

  @ApiProperty({ description: 'Sens de circulation', enum: ['both', 'one-way'], example: 'both' })
  @Allow()
  @IsOptional()
  @IsEnum(['both', 'one-way'])
  direction?: string;
}
