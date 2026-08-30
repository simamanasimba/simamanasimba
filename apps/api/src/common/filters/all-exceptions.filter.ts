import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import type { Logger } from "@event-intel/logger";
import type { AuthenticatedRequest } from "../types";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<AuthenticatedRequest>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException ? exception.getResponse() : { message: "Internal server error" };
    const message = typeof body === "string" ? body : ((body as { message?: unknown }).message ?? "Error");

    if (!isHttpException || status >= 500) {
      this.logger.error({ err: exception, requestId: req.requestId, path: req.path }, "Unhandled exception");
    }

    res.status(status).json({
      statusCode: status,
      message,
      code: isHttpException ? exception.constructor.name : "InternalServerError",
      requestId: req.requestId,
    });
  }
}
