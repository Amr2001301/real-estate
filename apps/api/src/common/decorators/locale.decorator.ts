import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type RequestLocale = 'ar' | 'en';

export const ReqLocale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestLocale => {
    const req = ctx.switchToHttp().getRequest();
    return (req.locale as RequestLocale) ?? 'ar';
  },
);
