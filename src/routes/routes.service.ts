import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from './route.entity';
import { CreateRouteDto } from './dto/create-route.dto';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private routeRepository: Repository<Route>,
  ) {}

  async create(createRouteDto: CreateRouteDto): Promise<Route> {
    const geoJsonCoordinates = createRouteDto.coordinates.map(
      ([lat, lng]) => [lng, lat]
    );

    const route = this.routeRepository.create({
      ...createRouteDto,
      coordinates: geoJsonCoordinates,
    });
    
    return this.routeRepository.save(route);
  }

  async findAll(): Promise<Route[]> {
    return this.routeRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Route> {
    const route = await this.routeRepository.findOne({ where: { id } });
    if (!route) throw new NotFoundException('Route non trouvée');
    return route;
  }
}
