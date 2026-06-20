import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimulationScenariosController } from './simulation-scenarios.controller';
import { SimulationScenariosService } from './simulation-scenarios.service';
import { SimulationScenario } from './simulation-scenario.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SimulationScenario])],
  controllers: [SimulationScenariosController],
  providers: [SimulationScenariosService],
})
export class SimulationScenariosModule {}
