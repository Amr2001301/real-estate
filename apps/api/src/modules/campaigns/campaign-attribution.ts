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

export type AdPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'MESSENGER' | 'AUDIENCE_NETWORK' | 'OTHER';

/**
 * Where on Meta (or elsewhere) a lead's ad ran, from its utm_source. Meta
 * fills `{{site_source_name}}` with fb / ig / msg / an; lead forms sent by
 * Zapier or Make carry `platform` as fb / ig. Null when nothing says — or
 * when the placeholder was never filled (the link opened outside an ad).
 */
export function adPlatform(utmSource: string | null | undefined): AdPlatform | null {
  const s = utmSource?.trim().toLowerCase();
  if (!s || s.includes('{{')) return null;
  if (/^(fb|facebook|m\.facebook|l\.facebook|lm\.facebook)(\.com)?$/.test(s)) return 'FACEBOOK';
  if (/^(ig|instagram|l\.instagram)(\.com)?$/.test(s)) return 'INSTAGRAM';
  if (/^(msg|messenger)$/.test(s)) return 'MESSENGER';
  if (/^(an|audience[_ -]?network)$/.test(s)) return 'AUDIENCE_NETWORK';
  return 'OTHER';
}
