import type { Request } from "express";
import type { RoleKey } from "@event-intel/database";

export interface RequestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  profilePhotoUrl: string | null;
  isPlatformOwner: boolean;
  mustChangePassword: boolean;
}

export interface RequestOrgMember {
  organizationId: string;
  role: RoleKey;
}

export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
  orgMember?: RequestOrgMember;
  requestId?: string;
}
