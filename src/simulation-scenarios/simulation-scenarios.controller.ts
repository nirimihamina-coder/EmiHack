import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { SimulationScenariosService } from './simulation-scenarios.service';
import { SimulationScenario } from './simulation-scenario.entity';
import { CreateSimulationScenarioDto } from './dto/create-simulation-scenario.dto';
import { UpdateSimulationScenarioDto } from './dto/update-simulation-scenario.dto';

@ApiTags('Simulation-Scenarios')
@Controller('simulation-scenarios')
export class SimulationScenariosController {
  constructor(private readonly service: SimulationScenariosService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un scénario de simulation' })
  @ApiBody({ type: CreateSimulationScenarioDto })
  @ApiResponse({ status: 201, description: 'Scénario créé', type: SimulationScenario })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() dto: CreateSimulationScenarioDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les scénarios' })
  @ApiResponse({ status: 200, description: 'Liste des scénarios', type: [SimulationScenario] })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: "Détails d'un scénario" })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Scénario', type: SimulationScenario })
  @ApiResponse({ status: 404, description: 'Scénario non trouvé' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Modifier un scénario" })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateSimulationScenarioDto })
  @ApiResponse({ status: 200, description: 'Scénario modifié', type: SimulationScenario })
  @ApiResponse({ status: 404, description: 'Scénario non trouvé' })
  update(@Param('id') id: string, @Body() dto: UpdateSimulationScenarioDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Supprimer un scénario" })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Scénario supprimé' })
  @ApiResponse({ status: 404, description: 'Scénario non trouvé' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
