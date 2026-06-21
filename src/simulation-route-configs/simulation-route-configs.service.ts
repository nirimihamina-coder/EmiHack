import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SimulationRouteConfig } from './simulation-route-config.entity';
import { CreateSimulationRouteConfigDto } from './dto/create-simulation-route-config.dto';
import { UpdateSimulationRouteConfigDto } from './dto/update-simulation-route-config.dto';

@Injectable()
export class SimulationRouteConfigsService {
  constructor(
    @InjectRepository(SimulationRouteConfig)
    private repository: Repository<SimulationRouteConfig>,
  ) {}

  async create(dto: CreateSimulationRouteConfigDto): Promise<SimulationRouteConfig> {
    const entity = this.repository.create({
      scenario: { id: dto.scenarioId },
      route: { id: dto.routeId },
      vehicleCount: dto.vehicleCount ?? 10,
      avgSpeed: dto.avgSpeed,
    });
    const saved = await this.repository.save(entity);
    return this.findOne(saved.id);
  }

  async findAll(): Promise<SimulationRouteConfig[]> {
    return this.repository.find({
      relations: { scenario: true, route: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<SimulationRouteConfig> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: { scenario: true, route: true },
    });
    if (!entity) throw new NotFoundException('Configuration non trouvée');
    return entity;
  }

  async findByScenario(scenarioId: string): Promise<SimulationRouteConfig[]> {
    return this.repository.find({
      where: { scenario: { id: scenarioId } },
      relations: { scenario: true, route: true },
    });
  }

  async update(id: string, dto: UpdateSimulationRouteConfigDto): Promise<SimulationRouteConfig> {
    const entity = await this.findOne(id);
    if (dto.scenarioId) (entity as any).scenario = { id: dto.scenarioId };
    if (dto.routeId) (entity as any).route = { id: dto.routeId };
    if (dto.vehicleCount !== undefined) entity.vehicleCount = dto.vehicleCount;
    if (dto.avgSpeed !== undefined) entity.avgSpeed = dto.avgSpeed;
    await this.repository.save(entity);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.remove(entity);
  }
}
