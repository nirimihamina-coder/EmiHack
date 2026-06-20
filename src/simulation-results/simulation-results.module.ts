import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimulationResultsController } from './simulation-results.controller';
import { SimulationResultsService } from './simulation-results.service';
import { SimulationResult } from './simulation-result.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SimulationResult])],
  controllers: [SimulationResultsController],
  providers: [SimulationResultsService],
})
export class SimulationResultsModule {}
