import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './shared/filters/http-exception.filter';

/** Shared HTTP boundary used by production bootstrap and production E2E. */
export function configureApplication(app: INestApplication): void {
  const config = app.get(ConfigService);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: [config.get<string>('WEB_URL', 'http://localhost:3000')],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-correlation-id'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
}
