import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportsModule } from './reports/reports.module';
import { RoutesModule } from './routes/routes.module';
import { IntersectionsModule } from './intersections/intersections.module';
import { RouteIntersectionsModule } from './route-intersections/route-intersections.module';
import { SimulationScenariosModule } from './simulation-scenarios/simulation-scenarios.module';
import { SimulationRouteConfigsModule } from './simulation-route-configs/simulation-route-configs.module';
import { SimulationResultsModule } from './simulation-results/simulation-results.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true,
        ssl: { rejectUnauthorized: false },
      }),
    }),
    ScheduleModule.forRoot(),
    ReportsModule,
    RoutesModule,
    IntersectionsModule,
    RouteIntersectionsModule,
    SimulationScenariosModule,
    SimulationRouteConfigsModule,
    SimulationResultsModule,
  ],
})
export class AppModule {}
