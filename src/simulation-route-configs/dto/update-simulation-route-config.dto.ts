import { PartialType } from '@nestjs/swagger';
import { CreateSimulationRouteConfigDto } from './create-simulation-route-config.dto';

export class UpdateSimulationRouteConfigDto extends PartialType(CreateSimulationRouteConfigDto) {}
