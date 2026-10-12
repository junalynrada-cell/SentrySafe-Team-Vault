import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../auth.types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const ALLOW_LOCKED_KEY = 'allowLocked';
export const AllowLocked = () => SetMetadata(ALLOW_LOCKED_KEY, true);

export const PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(PUBLIC_KEY, true);
