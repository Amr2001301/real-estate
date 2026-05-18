import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { BrokerScopeContext } from '../guards/broker-scope.guard';

/**
 * Returns the broker scope attached to the request by BrokerScopeGuard.
 * Routes that don't pass through BrokerScopeGuard will receive `undefined`.
 */
export const BrokerScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BrokerScopeContext | undefined => {
    const req = ctx.switchToHttp().getRequest<{
      brokerId?: string;
      brokerUserId?: string;
      brokerAgentUserId?: string;
    }>();
    if (!req.brokerId || !req.brokerUserId || !req.brokerAgentUserId) return undefined;
    return {
      brokerId: req.brokerId,
      brokerUserId: req.brokerUserId,
      brokerAgentUserId: req.brokerAgentUserId,
    };
  },
);
