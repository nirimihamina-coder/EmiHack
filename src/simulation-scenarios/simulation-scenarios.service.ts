import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SimulationScenario } from './simulation-scenario.entity';
import { CreateSimulationScenarioDto } from './dto/create-simulation-scenario.dto';
import { UpdateSimulationScenarioDto } from './dto/update-simulation-scenario.dto';

@Injectable()
export class SimulationScenariosService {
  constructor(
    @InjectRepository(SimulationScenario)
    private repository: Repository<SimulationScenario>,
  ) {}

  async create(dto: CreateSimulationScenarioDto): Promise<SimulationScenario> {
    const entity = this.repository.create(dto);
    return this.repository.save(entity);
  }

  async findAll(): Promise<SimulationScenario[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<SimulationScenario> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Scénario non trouvé');
    return entity;
  }

  async update(id: string, dto: UpdateSimulationScenarioDto): Promise<SimulationScenario> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repository.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.remove(entity);
  }
}
