import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class PortalPerformanceQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  /**
   * Agent-level filter. Only broker users with `isPrimaryContact` or
   * `canManageBrokerUsers` can filter by an agent other than themselves —
   * the service enforces that.
   */
  @IsOptional()
  @IsUUID()
  brokerAgentId?: string;
}
