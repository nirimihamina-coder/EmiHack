import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SimulationRouteConfigsService } from './simulation-route-configs.service';
import { SimulationRouteConfig } from './simulation-route-config.entity';
import { CreateSimulationRouteConfigDto } from './dto/create-simulation-route-config.dto';

@ApiTags('Simulation-Route-Configs')
@Controller('simulation-route-configs')
export class SimulationRouteConfigsController {
  constructor(private readonly service: SimulationRouteConfigsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une config route pour un scénario' })
  @ApiBody({ type: CreateSimulationRouteConfigDto })
  @ApiResponse({ status: 201, description: 'Config créée', type: SimulationRouteConfig })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() dto: CreateSimulationRouteConfigDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les configurations' })
  @ApiQuery({ name: 'scenarioId', required: false, description: 'Filtrer par scénario' })
  @ApiResponse({ status: 200, description: 'Liste des configs', type: [SimulationRouteConfig] })
  findAll(@Query('scenarioId') scenarioId?: string) {
    if (scenarioId) return this.service.findByScenario(scenarioId);
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: "Détails d'une configuration" })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Config', type: SimulationRouteConfig })
  @ApiResponse({ status: 404, description: 'Config non trouvée' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Supprimer une configuration" })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Config supprimée' })
  @ApiResponse({ status: 404, description: 'Config non trouvée' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
