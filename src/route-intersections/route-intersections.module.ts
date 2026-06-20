import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouteIntersectionsController } from './route-intersections.controller';
import { RouteIntersectionsService } from './route-intersections.service';
import { RouteIntersection } from './route-intersection.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RouteIntersection])],
  controllers: [RouteIntersectionsController],
  providers: [RouteIntersectionsService],
})
export class RouteIntersectionsModule {}
