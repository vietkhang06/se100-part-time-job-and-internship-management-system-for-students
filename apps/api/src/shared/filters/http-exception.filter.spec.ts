import { ArgumentsHost, BadRequestException, HttpException } from '@nestjs/common';
import type { Request } from 'express';
import { ApiErrorResponse } from '@campusjob/contracts';
import { GlobalExceptionFilter } from './http-exception.filter';

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const message = record.message;
  const code = record.code;
  const correlationId = record.correlationId;
  return (
    typeof record.statusCode === 'number' &&
    (typeof message === 'string' ||
      (Array.isArray(message) && message.every((item) => typeof item === 'string'))) &&
    typeof record.error === 'string' &&
    (code === undefined || typeof code === 'string') &&
    typeof record.timestamp === 'string' &&
    typeof record.path === 'string' &&
    (correlationId === undefined || typeof correlationId === 'string')
  );
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  const responseFor = (exception: unknown): ApiErrorResponse => {
    const json = jest.fn<void, [unknown]>();
    const response = { status: jest.fn().mockReturnThis(), json };
    const request = {
      headers: {},
      id: 'request-1',
      url: '/test/path',
      method: 'GET',
    } as Request;
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost;

    filter.catch(exception, host);
    const payload: unknown = json.mock.calls[0]?.[0];
    if (!isApiErrorResponse(payload)) {
      throw new Error('GlobalExceptionFilter returned an invalid ApiErrorResponse.');
    }
    return payload;
  };

  it('preserves a string message', () => {
    expect(responseFor(new HttpException('plain message', 400)).message).toBe('plain message');
  });

  it('preserves an array of string messages', () => {
    expect(responseFor(new BadRequestException({ message: ['first', 'second'] })).message).toEqual([
      'first',
      'second',
    ]);
  });

  it('preserves an empty string array', () => {
    expect(responseFor(new BadRequestException({ message: [] })).message).toEqual([]);
  });

  it.each([
    ['mixed values', ['message', 123, null]],
    ['only non-string values', [123, null, { detail: 'secret' }]],
    ['a non-string object', { detail: 'secret' }],
  ])('uses the safe fallback for %s messages', (_description, message) => {
    expect(responseFor(new BadRequestException({ message })).message).toBe('Internal server error');
  });

  it('preserves a valid string error code', () => {
    const result = responseFor(
      new HttpException({ message: 'invalid', error: 'Bad Request', code: 'CUSTOM_VALIDATION' }, 400),
    );
    expect(result.code).toBe('CUSTOM_VALIDATION');
  });

  it('ignores a non-string error code and derives the normal status code', () => {
    const result = responseFor(new BadRequestException({ message: 'invalid', code: { secret: 'value' } }));
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('derives a status code when no error code is provided', () => {
    expect(responseFor(new BadRequestException({ message: 'invalid' })).code).toBe('VALIDATION_ERROR');
  });

  it('replaces a non-string exception error field with the exception name', () => {
    const result = responseFor(new BadRequestException({ message: 'invalid', error: { secret: 'value' } }));
    expect(result.error).toBe('BadRequestException');
  });

  it('does not expose an unexpected exception message', () => {
    const result = responseFor(new Error('internal database details'));
    expect(result).toMatchObject({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
    expect(JSON.stringify(result)).not.toContain('internal database details');
  });
});
