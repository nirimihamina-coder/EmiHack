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
import { VoteDto } from './dto/vote.dto';
import { QueryReportsDto } from './dto/query-reports.dto';

@ApiTags('Signalements')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un signalement' })
  @ApiBody({ type: CreateReportDto })
  @ApiResponse({ status: 201, description: 'Signalement créé avec succès', type: Report })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() createReportDto: CreateReportDto) {
    return this.reportsService.create(createReportDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les signalements actifs' })
  @ApiQuery({ type: QueryReportsDto })
  @ApiResponse({ status: 200, description: 'Liste des signalements', type: [Report] })
  findAll(@Query() query: QueryReportsDto) {
    return this.reportsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtenir les statistiques des signalements' })
  @ApiResponse({ status: 200, description: 'Statistiques' })
  getStats() {
    return this.reportsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: "Obtenir les détails d'un signalement" })
  @ApiParam({ name: 'id', description: "ID du signalement", type: String })
  @ApiResponse({ status: 200, description: 'Détails du signalement', type: Report })
  @ApiResponse({ status: 404, description: 'Signalement non trouvé' })
  findById(@Param('id') id: string) {
    return this.reportsService.findById(id);
  }

  @Patch(':id/vote')
  @ApiOperation({ summary: 'Voter pour un signalement (up/down)' })
  @ApiParam({ name: 'id', description: "ID du signalement", type: String })
  @ApiBody({ type: VoteDto })
  @ApiResponse({ status: 200, description: 'Vote enregistré', type: Report })
  @ApiResponse({ status: 404, description: 'Signalement non trouvé' })
  vote(@Param('id') id: string, @Body() voteDto: VoteDto) {
    return this.reportsService.vote(id, voteDto.vote);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Marquer un signalement comme résolu' })
  @ApiParam({ name: 'id', description: "ID du signalement", type: String })
  @ApiResponse({ status: 200, description: 'Signalement résolu', type: Report })
  @ApiResponse({ status: 404, description: 'Signalement non trouvé' })
  resolve(@Param('id') id: string) {
    return this.reportsService.resolve(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Supprimer un signalement (seulement par le créateur)" })
  @ApiParam({ name: 'id', description: "ID du signalement", type: String })
  @ApiQuery({ name: 'userId', description: "ID de l'utilisateur (créateur)", type: String })
  @ApiResponse({ status: 200, description: 'Signalement supprimé' })
  @ApiResponse({ status: 400, description: "Vous n'êtes pas le créateur" })
  @ApiResponse({ status: 404, description: 'Signalement non trouvé' })
  delete(@Param('id') id: string, @Query('userId') userId: string) {
    return this.reportsService.delete(id, userId);
  }
}
