import { Role } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  sub: string; // user id
  companyId: string;
  role: Role;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
