import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks a route as not requiring an authenticated session (public attendance API, health checks, auth endpoints). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
