import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
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

  async create(createReportDto: CreateReportDto): Promise<Report> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    const report = this.reportRepository.create({ ...createReportDto, expiresAt });
    const saved = await this.reportRepository.save(report);

    this.reportsGateway.handleNewReport(saved);
    return saved;
  }

  async findAll(query: QueryReportsDto): Promise<Report[]> {
    const qb = this.reportRepository.createQueryBuilder('report');
    qb.where('report.status != :expired', { expired: 'expired' });

    if (query.type) qb.andWhere('report.type = :type', { type: query.type });
    if (query.severity) qb.andWhere('report.severity = :severity', { severity: query.severity });
    if (query.neighborhood) {
      qb.andWhere("report.location->>'neighborhood' = :neighborhood", { neighborhood: query.neighborhood });
    }

    qb.orderBy('report.createdAt', 'DESC');
    qb.take(query.limit || 50);

    let reports = await qb.getMany();

    const { lat, lng, radius } = query;
    if (lat !== undefined && lng !== undefined && radius !== undefined) {
      reports = reports.filter((r) => {
        const distance = this.haversineDistance(lat, lng, r.location.lat, r.location.lng);
        return distance <= radius;
      });
    }

    return reports;
  }

  async findById(id: string): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Signalement non trouvé');
    return report;
  }

  async vote(id: string, vote: 'up' | 'down'): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Signalement non trouvé');

    if (vote === 'up') report.upvotes += 1;
    else report.downvotes += 1;

    const saved = await this.reportRepository.save(report);
    this.reportsGateway.handleReportUpdated(saved);
    return saved;
  }

  async resolve(id: string): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Signalement non trouvé');

    report.status = 'resolved';
    const saved = await this.reportRepository.save(report);
    this.reportsGateway.handleReportUpdated(saved);
    return saved;
  }

  async delete(id: string, userId: string): Promise<void> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Signalement non trouvé');
    if (report.createdBy !== userId) {
      throw new BadRequestException("Vous n'êtes pas le créateur de ce signalement");
    }

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

    const byNeighborhood = await this.reportRepository
      .createQueryBuilder('report')
      .select("report.location->>'neighborhood'", 'neighborhood')
      .addSelect('COUNT(*)', 'count')
      .where("report.location->>'neighborhood' IS NOT NULL")
      .groupBy("report.location->>'neighborhood'")
      .getRawMany();

    return { total, byType, bySeverity, byNeighborhood };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireOldReports(): Promise<number> {
    const result = await this.reportRepository
      .createQueryBuilder()
      .update(Report)
      .set({ status: 'expired' })
      .where('expiresAt <= :now', { now: new Date() })
      .andWhere('status = :active', { active: 'active' })
      .execute();

    if (result.affected && result.affected > 0) {
      this.reportsGateway.handleReportsExpired(result.affected);
    }

    return result.affected || 0;
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
