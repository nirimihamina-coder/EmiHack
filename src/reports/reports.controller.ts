import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { Report } from './schemas/report.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { QueryReportsDto } from './dto/query-reports.dto';

@ApiTags('Signalements')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un signalement' })
  @ApiBody({ type: CreateReportDto })
  @ApiResponse({ status: 201, description: 'Signalement créé', type: Report })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() dto: CreateReportDto) {
    return this.reportsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les signalements' })
  @ApiQuery({ type: QueryReportsDto })
  @ApiResponse({ status: 200, description: 'Liste des signalements', type: [Report] })
  findAll(@Query() query: QueryReportsDto) {
    return this.reportsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques des signalements' })
  @ApiResponse({ status: 200, description: 'Statistiques' })
  getStats() {
    return this.reportsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: "Détails d'un signalement" })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Détails', type: Report })
  @ApiResponse({ status: 404, description: 'Signalement non trouvé' })
  findById(@Param('id') id: string) {
    return this.reportsService.findById(id);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Marquer un signalement comme résolu' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Signalement résolu', type: Report })
  @ApiResponse({ status: 404, description: 'Signalement non trouvé' })
  resolve(@Param('id') id: string) {
    return this.reportsService.resolve(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Supprimer un signalement" })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Signalement supprimé' })
  @ApiResponse({ status: 404, description: 'Signalement non trouvé' })
  delete(@Param('id') id: string) {
    return this.reportsService.delete(id);
  }
}
