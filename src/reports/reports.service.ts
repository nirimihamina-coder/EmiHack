import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './schemas/report.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { QueryReportsDto } from './dto/query-reports.dto';
import { ReportsGateway } from './reports.gateway';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    private readonly reportsGateway: ReportsGateway,
  ) {}

  async create(dto: CreateReportDto): Promise<Report> {
    const data: Partial<Report> = {
      type: dto.type,
      severity: dto.severity,
      description: dto.description,
      fokontanyName: dto.fokontanyName,
      lat: dto.lat,
      lon: dto.lon,
      positionOnRoute: dto.positionOnRoute,
      lanesBlocked: dto.lanesBlocked ?? 0,
      reportedBy: dto.reportedBy,
    };

    if (dto.routeId) data.route = { id: dto.routeId } as any;
    if (dto.endTime) data.endTime = new Date(dto.endTime);

    const report = this.reportRepository.create(data);
    const saved = await this.reportRepository.save(report);

    this.reportsGateway.handleNewReport(saved);
    return saved;
  }

  async findAll(query: QueryReportsDto): Promise<Report[]> {
    const qb = this.reportRepository.createQueryBuilder('report')
      .leftJoinAndSelect('report.route', 'route');

    if (query.type) qb.andWhere('report.type = :type', { type: query.type });
    if (query.severity) qb.andWhere('report.severity = :severity', { severity: query.severity });

    qb.orderBy('report.createdAt', 'DESC');
    qb.take(query.limit || 50);

    let reports = await qb.getMany();

    const { lat, lng, radius } = query;
    if (lat !== undefined && lng !== undefined && radius !== undefined) {
      reports = reports.filter((r) => {
        if (r.lat === undefined || r.lon === undefined) return false;
        const distance = this.haversineDistance(lat, lng, r.lat, r.lon);
        return distance <= radius;
      });
    }

    return reports;
  }

  async findAllSimple(): Promise<Report[]> {
    return this.reportRepository.find({
      relations: { route: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: { route: true },
    });
    if (!report) throw new NotFoundException('Signalement non trouvé');
    return report;
  }

  async resolve(id: string): Promise<Report> {
    const report = await this.findById(id);
    report.status = 'resolved';
    report.endTime = new Date();
    const saved = await this.reportRepository.save(report);
    this.reportsGateway.handleReportUpdated(saved);
    return saved;
  }

  async delete(id: string): Promise<void> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Signalement non trouvé');
    await this.reportRepository.delete(id);
  }

  async getStats() {
    const total = await this.reportRepository.count();

    const byType = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('report.type')
      .getRawMany();

    const bySeverity = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('report.severity')
      .getRawMany();

    return { total, byType, bySeverity };
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
