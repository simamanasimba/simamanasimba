import "reflect-metadata";
import { config as loadDotenv } from "dotenv";
import { resolve } from "path";

// Env vars live in one root .env (spec section 69) — apps run with their own
// package dir as cwd, so resolve up to the monorepo root explicitly rather
// than relying on dotenv's default cwd-relative lookup.
loadDotenv({ path: resolve(process.cwd(), "../../.env") });

import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Web app and API are separate origins by design (different ports in dev,
  // likely different subdomains in production) — Helmet's default
  // same-origin Cross-Origin-Resource-Policy would silently block the
  // browser from loading uploaded logos/report files embedded in the web
  // app, so relax it to cross-origin (this only affects that one header,
  // every other Helmet protection stays on its default).
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cookieParser());
  app.useStaticAssets(join(process.cwd(), "storage"), { prefix: "/files/" });

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap();
