import { PartialType } from '@nestjs/swagger';
import { CreateSimulationScenarioDto } from './create-simulation-scenario.dto';

export class UpdateSimulationScenarioDto extends PartialType(CreateSimulationScenarioDto) {}
