import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RouteIntersectionsService } from './route-intersections.service';
import { RouteIntersection } from './route-intersection.entity';
import { CreateRouteIntersectionDto } from './dto/create-route-intersection.dto';

@ApiTags('Route-Intersections')
@Controller('route-intersections')
export class RouteIntersectionsController {
  constructor(private readonly service: RouteIntersectionsService) {}

  @Post()
  @ApiOperation({ summary: "Créer une liaison route-intersection" })
  @ApiBody({ type: CreateRouteIntersectionDto })
  @ApiResponse({ status: 201, description: 'Liaison créée', type: RouteIntersection })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() dto: CreateRouteIntersectionDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les liaisons route-intersection' })
  @ApiQuery({ name: 'intersectionId', required: false, description: 'Filtrer par intersection' })
  @ApiQuery({ name: 'routeId', required: false, description: 'Filtrer par route' })
  @ApiResponse({ status: 200, description: 'Liste des liaisons', type: [RouteIntersection] })
  findAll(
    @Query('intersectionId') intersectionId?: string,
    @Query('routeId') routeId?: string,
  ) {
    if (intersectionId) return this.service.findByIntersection(intersectionId);
    if (routeId) return this.service.findByRoute(routeId);
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: "Détails d'une liaison" })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Liaison', type: RouteIntersection })
  @ApiResponse({ status: 404, description: 'Liaison non trouvée' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
