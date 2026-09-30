import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const headerName = 'x-request-id';
    const requestId = (req.headers[headerName] as string) || uuidv4();
    (req as any).id = requestId;
    res.setHeader(headerName, requestId);
    next();
  }
}
