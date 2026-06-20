import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);
  app.enableCors({ origin: '*', methods: 'GET,HEAD,PUT,PATCH,POST,DELETE' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/', (req: any, res: any) => {
    res.sendFile('osmr.html', { root: process.cwd() });
  });

  const config = new DocumentBuilder()
    .setTitle('Tana Traffic - Signalements')
    .setDescription('API de signalement en temps réel pour les transports à Antananarivo')
    .setVersion('1.0')
    .setContact('Équipe Tana Traffic', '', '')
    .addServer('https://emihack.onrender.com', 'Production')
    .addServer('http://localhost:3000', 'Développement')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
