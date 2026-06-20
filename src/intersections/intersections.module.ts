import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntersectionsController } from './intersections.controller';
import { IntersectionsService } from './intersections.service';
import { Intersection } from './intersection.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Intersection])],
  controllers: [IntersectionsController],
  providers: [IntersectionsService],
})
export class IntersectionsModule {}
