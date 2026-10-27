import type { PrismaService } from '../../common/prisma/prisma.service';

/** utm_campaign as campaign codes are kept: trimmed, lowercase. */
export function normalizeCampaignCode(raw: string | null | undefined): string | null {
  const code = raw?.trim().toLowerCase();
  return code ? code : null;
}

/**
 * The company's campaign a utm_campaign names, with the source and project a
 * lead from it is filed under. Null when no campaign carries that code.
 */
export async function campaignForUtm(
  prisma: PrismaService,
  companyId: string | null | undefined,
  utmCampaign: string | null | undefined,
): Promise<{ id: string; sourceId: string | null; projectId: string | null } | null> {
  const code = normalizeCampaignCode(utmCampaign);
  if (!code || !companyId) return null;
  return prisma.campaign.findFirst({
    where: { companyId, code },
    select: { id: true, sourceId: true, projectId: true },
  });
}
