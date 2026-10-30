import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { M04WorkflowError } from '../application/m04-ports';
import { InvalidApplicationTransitionError } from '../domain/application-state';
import { InvalidInterviewActionError } from '../../interviews/domain/interview-rules';

@Catch(M04WorkflowError, InvalidApplicationTransitionError, InvalidInterviewActionError)
export class M04ExceptionFilter implements ExceptionFilter {
  catch(exception: M04WorkflowError | InvalidApplicationTransitionError | InvalidInterviewActionError, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const code = exception instanceof M04WorkflowError ? exception.code : 'INVALID_STATE';
    const status = code === 'NOT_FOUND' ? HttpStatus.NOT_FOUND
      : code === 'FORBIDDEN' ? HttpStatus.FORBIDDEN
      : code === 'INVALID_INPUT' ? HttpStatus.BAD_REQUEST
      : HttpStatus.CONFLICT;
    response.status(status).json({
      statusCode: status, message: exception.message, error: exception.name,
      code, timestamp: new Date().toISOString(), path: request.url,
      correlationId: request.headers['x-correlation-id'] || request.headers['x-request-id'] || request.id,
    });
  }
}
