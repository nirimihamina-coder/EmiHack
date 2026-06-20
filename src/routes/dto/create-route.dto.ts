import { IsString, IsNotEmpty, IsNumber, IsArray, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @IsNumber({}, { each: true })
  coordinates!: number[][];

  @ApiProperty({ description: 'Distance totale en km', example: 15.3 })
  @IsNumber()
  distance!: number;

  @ApiProperty({ description: 'Durée estimée en minutes', example: 35 })
  @IsNumber()
  duration!: number;
}
