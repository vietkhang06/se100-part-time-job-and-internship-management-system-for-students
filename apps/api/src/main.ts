import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT', 8080);
  const webUrl = configService.get<string>('WEB_URL', 'http://localhost:3000');
  const allowedOrigins = webUrl
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // In development, also permit port 3001 if port 3000 was occupied
  if (configService.get<string>('NODE_ENV', 'development') === 'development') {
    if (!allowedOrigins.includes('http://localhost:3000')) allowedOrigins.push('http://localhost:3000');
    if (!allowedOrigins.includes('http://localhost:3001')) allowedOrigins.push('http://localhost:3001');
  }

  // Security Middleware
  app.use(helmet());
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-correlation-id'],
  });

  // Global Prefix
  app.setGlobalPrefix('api/v1');

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global Exception Filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CampusJob API')
    .setDescription('REST API for CampusJob Student Part-Time & Internship Management System')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  logger.log(`CampusJob API running on http://localhost:${port}/api/v1`);
  logger.log(`Swagger documentation available at http://localhost:${port}/docs`);
  logger.log(`CORS enabled for origins: ${allowedOrigins.join(', ')}`);
}
bootstrap();
