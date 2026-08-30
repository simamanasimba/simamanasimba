import { Controller, Get } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { Public } from "../../common/decorators/public.decorator";

/** Unauthenticated branding for the marketing landing page — name/logo/hero image only, nothing else. */
@Public()
@Controller("api/v1/public/branding")
export class PublicBrandingController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  get() {
    return this.organizations.getPublicBranding();
  }
}
