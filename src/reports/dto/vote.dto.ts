import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoteDto {
  @ApiProperty({ description: 'Vote', enum: ['up', 'down'], example: 'up' })
  @IsEnum(['up', 'down'])
  vote: 'up' | 'down';
}
