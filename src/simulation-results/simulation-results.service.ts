import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SimulationResult } from './simulation-result.entity';
import { CreateSimulationResultDto } from './dto/create-simulation-result.dto';

@Injectable()
export class SimulationResultsService {
  constructor(
    @InjectRepository(SimulationResult)
    private repository: Repository<SimulationResult>,
  ) {}

  async create(dto: CreateSimulationResultDto): Promise<SimulationResult> {
    const data: Partial<SimulationResult> = {
      avgTravelTime: dto.avgTravelTime,
      maxCongestionLevel: dto.maxCongestionLevel,
      totalVehicles: dto.totalVehicles,
      bottlenecks: dto.bottlenecks,
      suggestions: dto.suggestions,
    };
    if (dto.scenarioId) data.scenario = { id: dto.scenarioId } as any;

    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findAll(): Promise<SimulationResult[]> {
    return this.repository.find({
      relations: { scenario: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<SimulationResult> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: { scenario: true },
    });
    if (!entity) throw new NotFoundException('Résultat non trouvé');
    return entity;
  }

  async findByScenario(scenarioId: string): Promise<SimulationResult[]> {
    return this.repository.find({
      where: { scenario: { id: scenarioId } },
      relations: { scenario: true },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.remove(entity);
  }
}
