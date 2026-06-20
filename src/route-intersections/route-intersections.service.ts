import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RouteIntersection } from './route-intersection.entity';
import { CreateRouteIntersectionDto } from './dto/create-route-intersection.dto';

@Injectable()
export class RouteIntersectionsService {
  constructor(
    @InjectRepository(RouteIntersection)
    private repository: Repository<RouteIntersection>,
  ) {}

  async create(dto: CreateRouteIntersectionDto): Promise<RouteIntersection> {
    const entity = this.repository.create({
      intersection: { id: dto.intersectionId },
      route1: { id: dto.routeId1 },
      route2: { id: dto.routeId2 },
      priorityRoute: { id: dto.priorityRouteId },
      positionOnRoute1: dto.positionOnRoute1,
      positionOnRoute2: dto.positionOnRoute2,
    });
    return this.repository.save(entity);
  }

  async findAll(): Promise<RouteIntersection[]> {
    return this.repository.find({
      relations: { intersection: true, route1: true, route2: true, priorityRoute: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<RouteIntersection> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: { intersection: true, route1: true, route2: true, priorityRoute: true },
    });
    if (!entity) throw new NotFoundException('RouteIntersection non trouvée');
    return entity;
  }

  async findByIntersection(intersectionId: string): Promise<RouteIntersection[]> {
    return this.repository.find({
      where: { intersection: { id: intersectionId } },
      relations: { intersection: true, route1: true, route2: true, priorityRoute: true },
    });
  }

  async findByRoute(routeId: string): Promise<RouteIntersection[]> {
    return this.repository.find({
      where: [
        { route1: { id: routeId } },
        { route2: { id: routeId } },
      ],
      relations: { intersection: true, route1: true, route2: true, priorityRoute: true },
    });
  }
}
