import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SimulationResultsService } from './simulation-results.service';
import { SimulationResult } from './simulation-result.entity';
import { CreateSimulationResultDto } from './dto/create-simulation-result.dto';

@ApiTags('Simulation-Results')
@Controller('simulation-results')
export class SimulationResultsController {
  constructor(private readonly service: SimulationResultsService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer un résultat de simulation' })
  @ApiBody({ type: CreateSimulationResultDto })
  @ApiResponse({ status: 201, description: 'Résultat créé', type: SimulationResult })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() dto: CreateSimulationResultDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les résultats' })
  @ApiQuery({ name: 'scenarioId', required: false, description: 'Filtrer par scénario' })
  @ApiResponse({ status: 200, description: 'Liste des résultats', type: [SimulationResult] })
  findAll(@Query('scenarioId') scenarioId?: string) {
    if (scenarioId) return this.service.findByScenario(scenarioId);
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: "Détails d'un résultat" })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Résultat', type: SimulationResult })
  @ApiResponse({ status: 404, description: 'Résultat non trouvé' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Supprimer un résultat" })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Résultat supprimé' })
  @ApiResponse({ status: 404, description: 'Résultat non trouvé' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
