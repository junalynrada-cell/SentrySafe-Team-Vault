import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthContext } from '../auth.types';

export const CurrentAuth = createParamDecorator(
  (data: keyof AuthContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const auth: AuthContext = request.auth;
    if (!auth) return null;
    return data ? auth[data] : auth;
  },
);

export const CurrentPreAuth = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const preAuth = request.preAuth;
    if (!preAuth) return null;
    return data ? preAuth[data] : preAuth;
  },
);

