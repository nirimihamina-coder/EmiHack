import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Intersection } from './intersection.entity';
import { CreateIntersectionDto } from './dto/create-intersection.dto';

@Injectable()
export class IntersectionsService {
  constructor(
    @InjectRepository(Intersection)
    private intersectionRepository: Repository<Intersection>,
  ) {}

  async create(dto: CreateIntersectionDto): Promise<Intersection> {
    const intersection = this.intersectionRepository.create(dto);
    return this.intersectionRepository.save(intersection);
  }

  async findAll(): Promise<Intersection[]> {
    return this.intersectionRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Intersection> {
    const i = await this.intersectionRepository.findOne({ where: { id } });
    if (!i) throw new NotFoundException('Intersection non trouvée');
    return i;
  }

  async findByType(type: string): Promise<Intersection[]> {
    return this.intersectionRepository.find({ where: { type }, order: { createdAt: 'DESC' } });
  }
}
