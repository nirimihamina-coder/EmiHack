import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity()
export class User {
  @ApiProperty({ description: 'ID unique', example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ description: 'Email', example: 'user@example.com' })
  @Column()
  email!: string;

  @ApiPropertyOptional({ description: 'Prénom', example: 'Jean' })
  @Column({ nullable: true })
  firstName?: string;

  @ApiPropertyOptional({ description: 'Nom', example: 'Dupont' })
  @Column({ nullable: true })
  lastName?: string;

  @ApiPropertyOptional({ description: 'URL de la photo', example: 'https://example.com/avatar.jpg' })
  @Column({ nullable: true })
  avatar?: string;
}
