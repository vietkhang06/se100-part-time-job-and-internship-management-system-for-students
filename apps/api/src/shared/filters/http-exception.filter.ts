import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '@campusjob/contracts';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const respObj = exceptionResponse as Record<string, any>;
      message = respObj['message'] || message;
      error = respObj['error'] || (exception instanceof HttpException ? exception.name : error);
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const correlationId = (request.headers['x-correlation-id'] ||
      request.headers['x-request-id'] ||
      (request as any).id) as string | undefined;

    const errorPayload: ApiErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status ${status} - Error: ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`[${request.method}] ${request.url} - Status ${status} - Error: ${JSON.stringify(message)}`);
    }

    response.status(status).json(errorPayload);
  }
}
