import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { BrokerScopeContext } from '../../common/guards/broker-scope.guard';
import { BrokerReportsService } from '../broker-reports/broker-reports.service';
import { PortalPerformanceQueryDto } from './dto/portal-performance.dto';

/**
 * Broker portal performance is a scoped wrapper around the admin
 * `BrokerReportsService.brokerDetail()` — we never expose company-wide
 * numbers to a broker, only their own broker firm's slice.
 *
 * Agent-level filtering is permitted only for broker users with
 * `isPrimaryContact` or `canManageBrokerUsers`. Other agents are silently
 * scoped to their own brokerAgentId so they can't peek at colleagues'
 * numbers.
 */
@Injectable()
export class BrokerPortalPerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: BrokerReportsService,
  ) {}

  async forBroker(scope: BrokerScopeContext, query: PortalPerformanceQueryDto) {
    const { brokerAgentId, canSeeAllAgents } = await this.resolveAgentScope(
      scope,
      query.brokerAgentId,
    );

    const detail = await this.reports.brokerDetail(scope.brokerId, {
      from: query.from,
      to: query.to,
      projectId: query.projectId,
      brokerAgentId,
    });

    // Hide the firm-wide agent breakdown when the caller is a non-manager
    // broker user. They only see their own metrics in the summary above.
    if (!canSeeAllAgents) {
      detail.agentBreakdown = detail.agentBreakdown.filter(
        (r) => r.brokerAgentId === scope.brokerAgentUserId,
      );
    }

    return { ...detail, canSeeAllAgents };
  }

  async exportCsv(scope: BrokerScopeContext, query: PortalPerformanceQueryDto) {
    // Same scoping as forBroker — never leak firm-wide numbers to non-managers.
    const { brokerAgentId } = await this.resolveAgentScope(
      scope,
      query.brokerAgentId,
    );
    return this.reports.brokerDetailCsv(scope.brokerId, {
      from: query.from,
      to: query.to,
      projectId: query.projectId,
      brokerAgentId,
    });
  }

  async agents(scope: BrokerScopeContext, query: PortalPerformanceQueryDto) {
    const { canSeeAllAgents } = await this.resolveAgentScope(scope, query.brokerAgentId);
    const result = await this.reports.agents({
      brokerId: scope.brokerId,
      from: query.from,
      to: query.to,
      projectId: query.projectId,
    });
    if (!canSeeAllAgents) {
      return {
        data: result.data.filter((r) => r.brokerAgentId === scope.brokerAgentUserId),
      };
    }
    return result;
  }

  /**
   * Returns the brokerAgentId the caller is allowed to query.
   * - Managers (primary contact OR canManageBrokerUsers) can pass any
   *   brokerAgentId, or omit it to see firm-wide numbers.
   * - Non-managers are pinned to their own userId regardless of what they
   *   pass in.
   */
  private async resolveAgentScope(
    scope: BrokerScopeContext,
    requested: string | undefined,
  ): Promise<{ brokerAgentId: string | undefined; canSeeAllAgents: boolean }> {
    const me = await this.prisma.brokerUser.findUnique({
      where: { id: scope.brokerUserId },
      select: {
        userId: true,
        brokerId: true,
        isPrimaryContact: true,
        canManageBrokerUsers: true,
      },
    });
    if (!me) {
      throw new ForbiddenException('Broker profile not found');
    }
    const canSeeAllAgents = me.isPrimaryContact || me.canManageBrokerUsers;
    if (!canSeeAllAgents) {
      return { brokerAgentId: me.userId, canSeeAllAgents };
    }
    // Manager: if they asked for an agent, verify the agent belongs to the
    // same broker firm before honouring the filter.
    if (requested) {
      const agent = await this.prisma.brokerUser.findFirst({
        where: { userId: requested, brokerId: scope.brokerId },
        select: { userId: true },
      });
      if (!agent) {
        throw new ForbiddenException('Agent not found in this broker firm');
      }
      return { brokerAgentId: agent.userId, canSeeAllAgents };
    }
    return { brokerAgentId: undefined, canSeeAllAgents };
  }
}
