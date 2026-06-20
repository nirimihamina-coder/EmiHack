import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
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

  @Get()
  @ApiOperation({ summary: 'Lister toutes les routes enregistrées' })
  @ApiResponse({ status: 200, description: 'Liste des routes', type: [Route] })
  findAll() {
    return this.routesService.findAll();
  }
}
