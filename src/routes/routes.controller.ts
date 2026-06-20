import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { Route } from './route.entity';
import { CreateRouteDto } from './dto/create-route.dto';

@ApiTags('Routes')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer une nouvelle route tracée' })
  @ApiBody({ type: CreateRouteDto })
  @ApiResponse({ status: 201, description: 'Route créée avec succès', type: Route })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() createRouteDto: CreateRouteDto) {
    return this.routesService.create(createRouteDto);
  }

  @Get('all')
  @ApiOperation({ summary: 'Lister toutes les routes avec les coordonnées' })
  @ApiResponse({ status: 200, description: 'Liste complète des routes', type: [Route] })
  async findAllWithCoords() {
    return this.routesService.findAll();
  }

  @Get()
  @ApiOperation({ summary: 'Lister les routes (sans les coordonnées)' })
  @ApiResponse({ status: 200, description: 'Liste des routes avec URL vers les coordonnées' })
  async findAll(@Req() req: Request) {
    const routes = await this.routesService.findAll();
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return routes.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      distance: r.distance,
      duration: r.duration,
      lanes: r.lanes,
      speedLimit: r.speedLimit,
      direction: r.direction,
      createdAt: r.createdAt,
      coordinatesUrl: `${baseUrl}/routes/${r.id}/coordinates`,
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: "Obtenir les détails d'une route" })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Détails de la route', type: Route })
  @ApiResponse({ status: 404, description: 'Route non trouvée' })
  findOne(@Param('id') id: string) {
    return this.routesService.findOne(id);
  }

  @Get(':id/coordinates')
  @ApiOperation({ summary: "Obtenir les coordonnées d'une route" })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Tableau de coordonnées' })
  @ApiResponse({ status: 404, description: 'Route non trouvée' })
  async getCoordinates(@Param('id') id: string) {
    const route = await this.routesService.findOne(id);
    return route.coordinates;
  }
}
