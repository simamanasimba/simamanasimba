import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

/**
 * Guards internal-only endpoints called by the worker's scheduled jobs
 * (spec section 6's QUEUE → AI/Connectors/Reports fan-out) — a shared
 * secret header, not a user session. Never expose these routes to the web app.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers["x-internal-key"];
    const expected = process.env.INTERNAL_API_KEY;
    if (!expected || provided !== expected) {
      throw new UnauthorizedException("Invalid internal API key");
    }
    return true;
  }
}
