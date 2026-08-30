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
import { json } from "express";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  // bodyParser: false — the session cookie is SameSite=None (required since
  // the web app and API live on different domains), which strips the usual
  // SameSite CSRF protection. CORS already blocks cross-site JSON requests
  // (the JSON content-type forces a preflight, which the specific-origin
  // CORS config rejects), but Express's default urlencoded() parser would
  // still turn a plain cross-site <form> POST (no preflight needed) into a
  // populated req.body, letting any page silently drive this API using the
  // victim's cookies. Registering only the JSON parser below closes that gap
  // — nothing here legitimately sends urlencoded bodies (uploads are
  // multipart, handled separately by multer).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.use(json());

  // Railway (like most PaaS) terminates TLS and proxies every request through
  // a single internal hop — without this, req.ip resolves to that proxy's
  // address for every request, which breaks per-client rate limiting (one
  // bucket shared by all users) and mis-attributes IPs in session/audit logs.
  app.set("trust proxy", 1);

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
