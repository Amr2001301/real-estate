import { SetMetadata } from '@nestjs/common';

export const REQUIRE_CAPABILITY_KEY = 'require_capability';

/**
 * MT-039 — Declares a capability requirement for a route or controller.
 * The CapabilityGuard reads this metadata and checks the authenticated user's
 * Company.capabilities blob via CapabilityService.
 *
 * Usage:
 *   @RequireCapability('crm')
 *   @Get('leads')
 *   listLeads() { ... }
 *
 * The decorator only declares the requirement — it does not fetch any data.
 * Must be paired with CapabilityGuard (registered globally or on the controller).
 */
export const RequireCapability = (capability: string) =>
  SetMetadata(REQUIRE_CAPABILITY_KEY, capability);
