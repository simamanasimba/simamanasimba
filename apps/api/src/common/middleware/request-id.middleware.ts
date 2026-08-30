import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import type { AuthenticatedRequest } from "../types";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  }
}
