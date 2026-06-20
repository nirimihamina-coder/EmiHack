import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { IntersectionsService } from './intersections.service';
import { Intersection } from './intersection.entity';
import { CreateIntersectionDto } from './dto/create-intersection.dto';

@ApiTags('Intersections')
@Controller('intersections')
export class IntersectionsController {
  constructor(private readonly intersectionsService: IntersectionsService) {}

  @Post()
  @ApiOperation({ summary: "Créer une intersection" })
  @ApiBody({ type: CreateIntersectionDto })
  @ApiResponse({ status: 201, description: 'Intersection créée', type: Intersection })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() dto: CreateIntersectionDto) {
    return this.intersectionsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Lister les intersections" })
  @ApiQuery({ name: 'type', required: false, enum: ['roundabout', 'stop', 'priority', 'uncontrolled'] })
  @ApiResponse({ status: 200, description: 'Liste des intersections', type: [Intersection] })
  findAll(@Query('type') type?: string) {
    if (type) return this.intersectionsService.findByType(type);
    return this.intersectionsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: "Détails d'une intersection" })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Intersection', type: Intersection })
  @ApiResponse({ status: 404, description: 'Intersection non trouvée' })
  findOne(@Param('id') id: string) {
    return this.intersectionsService.findOne(id);
  }
}
