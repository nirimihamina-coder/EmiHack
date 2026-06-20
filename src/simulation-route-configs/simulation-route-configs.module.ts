import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimulationRouteConfigsController } from './simulation-route-configs.controller';
import { SimulationRouteConfigsService } from './simulation-route-configs.service';
import { SimulationRouteConfig } from './simulation-route-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SimulationRouteConfig])],
  controllers: [SimulationRouteConfigsController],
  providers: [SimulationRouteConfigsService],
})
export class SimulationRouteConfigsModule {}
