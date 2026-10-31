import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse, AuthErrorCode } from '@campusjob/contracts';

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
    let code: string | undefined = undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const respObj = exceptionResponse as Record<string, unknown>;
      const responseMessage = respObj['message'];
      if (
        typeof responseMessage === 'string' ||
        (Array.isArray(responseMessage) && responseMessage.every((item) => typeof item === 'string'))
      ) {
        message = responseMessage;
      }
      const responseError = respObj['error'];
      error = typeof responseError === 'string'
        ? responseError
        : exception instanceof HttpException ? exception.name : error;
      const responseCode = respObj['code'] ?? respObj['errorCode'];
      code = typeof responseCode === 'string' ? responseCode : undefined;
    }

    if (!code) {
      if (status === HttpStatus.BAD_REQUEST) {
        if (Array.isArray(message)) {
          if (message.some((m) => typeof m === 'string' && m.includes('Only STUDENT and EMPLOYER roles are permitted'))) {
            code = AuthErrorCode.ROLE_DISALLOWED;
          } else if (
            message.some(
              (m) =>
                typeof m === 'string' &&
                (m.includes('Password must be at least 8 characters long') ||
                  m.includes('password must be at least 8 characters long')),
            )
          ) {
            code = AuthErrorCode.WEAK_PASSWORD;
          } else {
            code = AuthErrorCode.VALIDATION_ERROR;
          }
        } else if (typeof message === 'string') {
          if (message.includes('Only STUDENT and EMPLOYER roles are permitted')) {
            code = AuthErrorCode.ROLE_DISALLOWED;
          } else if (message.includes('Password must be at least 8 characters long')) {
            code = AuthErrorCode.WEAK_PASSWORD;
          } else {
            code = AuthErrorCode.VALIDATION_ERROR;
          }
        }
      } else if (status === HttpStatus.UNAUTHORIZED) {
        code = AuthErrorCode.UNAUTHORIZED;
      } else if (status === HttpStatus.FORBIDDEN) {
        code = AuthErrorCode.FORBIDDEN;
      } else if (status === HttpStatus.CONFLICT) {
        code = AuthErrorCode.EMAIL_ALREADY_EXISTS;
      }
    }

    const correlationId = (request.headers['x-correlation-id'] ||
      request.headers['x-request-id'] ||
      request.id) as string | undefined;

    const errorPayload: ApiErrorResponse = {
      statusCode: status,
      message,
      error,
      ...(code ? { code } : {}),
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
