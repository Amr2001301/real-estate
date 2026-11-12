import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { openSecret, sealSecret } from '../../common/security/totp';
import { getRequiredCompanyId, runInCompany } from '../../common/tenant/tenant-context';
import { LeadIntakeService } from '../lead-intake/lead-intake.service';
import { MetaGraphClient } from './meta-graph.client';
import { mapGraphLead } from './meta-lead-fields';
import { metaConfig, readState, signState, verifyWebhookSignature } from './meta-config';
import type { MetaRoutingDto } from './meta-leads.dto';

interface LeadgenChange {
  field?: string;
  value?: { leadgen_id?: string; page_id?: string; form_id?: string };
}
export interface MetaWebhookBody {
  object?: string;
  entry?: Array<{ id?: string; changes?: LeadgenChange[] }>;
}

const VIEW = {
  id: true, pageId: true, pageName: true, status: true, lastLeadAt: true, leadCount: true, createdAt: true,
  campaign: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
} as const;

@Injectable()
export class MetaLeadsService {
  private readonly log = new Logger(MetaLeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: MetaGraphClient,
    private readonly intake: LeadIntakeService,
  ) {}

  // ── The company's side (admin) ─────────────────────────────────────────────

  async status() {
    const companyId = getRequiredCompanyId();
    const connections = await this.prisma.metaConnection.findMany({
      where: { companyId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: VIEW,
    });
    return { configured: metaConfig() !== null, connections };
  }

  /** The Facebook login address for this admin to link a Page. */
  connectUrl(userId: string): { url: string } {
    const cfg = metaConfig();
    if (!cfg) throw new BadRequestException('Facebook connection is not configured');
    return { url: this.graph.loginUrl(signState(getRequiredCompanyId(), userId, cfg.appSecret)) };
  }

  /**
   * Facebook sent the admin back with a login code: the Pages they manage are kept, sealed, as
   * PENDING until the admin picks which to link. Returns where to send the browser next.
   */
  async callback(params: { code?: string; state?: string; error?: string }): Promise<string> {
    const cfg = metaConfig();
    if (!cfg) throw new BadRequestException('Facebook connection is not configured');
    const back = (result: string) => `${cfg.adminUrl}/dashboard/campaigns/intake?meta=${result}`;
    const who = readState(params.state, cfg.appSecret);
    if (!who) return back('invalid');
    if (params.error || !params.code) return back('cancelled');
    try {
      const pages = await this.graph.pages(await this.graph.userToken(params.code));
      for (const p of pages) {
        const existing = await this.prisma.metaConnection.findUnique({ where: { pageId: p.id }, select: { companyId: true, status: true } });
        // A Page serves one company at a time: one that is live for another company is left alone.
        if (existing && existing.companyId !== who.companyId && existing.status === 'ACTIVE') continue;
        const tokenEnc = sealSecret(p.access_token, cfg.sealKey);
        await this.prisma.metaConnection.upsert({
          where: { pageId: p.id },
          create: { companyId: who.companyId, pageId: p.id, pageName: p.name.slice(0, 200), tokenEnc, connectedById: who.userId },
          update: existing?.companyId === who.companyId
            ? { pageName: p.name.slice(0, 200), tokenEnc }
            : { companyId: who.companyId, pageName: p.name.slice(0, 200), tokenEnc, status: 'PENDING', connectedById: who.userId, campaignId: null, projectId: null },
        });
      }
      return back('connected');
    } catch (err) {
      this.log.warn(`Facebook callback failed: ${(err as Error).message}`);
      return back('error');
    }
  }

  /** Links a Page: our app starts receiving its lead events and they flow into the company's leads. */
  async activate(id: string, dto: MetaRoutingDto) {
    const companyId = getRequiredCompanyId();
    const cfg = metaConfig();
    if (!cfg) throw new BadRequestException('Facebook connection is not configured');
    const row = await this.own(id, companyId);
    await this.assertRefs(companyId, dto.campaignId ?? undefined, dto.projectId ?? undefined);
    await this.graph.subscribePage(row.pageId, openSecret(row.tokenEnc, cfg.sealKey));
    return this.prisma.metaConnection.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        ...(dto.campaignId !== undefined ? { campaignId: dto.campaignId } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
      },
      select: VIEW,
    });
  }

  async route(id: string, dto: MetaRoutingDto) {
    const companyId = getRequiredCompanyId();
    await this.own(id, companyId);
    await this.assertRefs(companyId, dto.campaignId ?? undefined, dto.projectId ?? undefined);
    return this.prisma.metaConnection.update({
      where: { id },
      data: {
        ...(dto.campaignId !== undefined ? { campaignId: dto.campaignId } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
      },
      select: VIEW,
    });
  }

  /** Unlinks a Page: its events stop (best effort at Facebook) and the stored token is deleted. */
  async disconnect(id: string) {
    const companyId = getRequiredCompanyId();
    const cfg = metaConfig();
    const row = await this.own(id, companyId);
    if (cfg && row.status === 'ACTIVE') {
      try {
        await this.graph.unsubscribePage(row.pageId, openSecret(row.tokenEnc, cfg.sealKey));
      } catch (err) {
        this.log.warn(`Unsubscribing page ${row.pageId} failed: ${(err as Error).message}`);
      }
    }
    await this.prisma.metaConnection.delete({ where: { id } });
    return { ok: true };
  }

  // ── Facebook's side (public, signed) ───────────────────────────────────────

  /** Facebook's check that this address is ours, when the webhook is set up. */
  verifyChallenge(mode: string | undefined, token: string | undefined, challenge: string | undefined): string {
    const cfg = metaConfig();
    if (!cfg || mode !== 'subscribe' || token !== cfg.verifyToken || !challenge) throw new ForbiddenException('Verification failed');
    return challenge;
  }

  /**
   * Lead events from Facebook. The signature proves it is Facebook; each lead is fetched with the
   * Page's token and filed under the Page's company. A failure is thrown so Facebook retries.
   */
  async receive(rawBody: Buffer | undefined, signature: string | undefined, body: MetaWebhookBody): Promise<{ received: number }> {
    const cfg = metaConfig();
    if (!cfg || !verifyWebhookSignature(rawBody, signature, cfg.appSecret)) throw new ForbiddenException('Invalid signature');
    let received = 0;
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'leadgen' || !change.value?.leadgen_id) continue;
        await this.takeLead(change.value.page_id ?? entry.id ?? '', change.value.leadgen_id);
        received++;
      }
    }
    return { received };
  }

  private async takeLead(pageId: string, leadgenId: string): Promise<void> {
    const cfg = metaConfig();
    if (!cfg) return;
    const conn = await this.prisma.metaConnection.findUnique({ where: { pageId } });
    if (!conn || conn.status !== 'ACTIVE') return; // a Page we no longer serve

    // Facebook may deliver an event twice: the first one to record it wins.
    try {
      await this.prisma.metaLeadReceipt.create({ data: { leadgenId, companyId: conn.companyId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
    try {
      const graphLead = await this.graph.lead(leadgenId, openSecret(conn.tokenEnc, cfg.sealKey));
      const mapped = mapGraphLead(graphLead);
      if (!mapped) {
        this.log.warn(`Lead ${leadgenId} on page ${pageId} had no phone number; not recorded`);
        return;
      }
      const result = await runInCompany(conn.companyId, () =>
        this.intake.ingest(
          { name: `Facebook — ${conn.pageName}`, campaignId: conn.campaignId, projectId: conn.projectId },
          {
            name: mapped.name,
            phone: mapped.phone,
            email: mapped.email,
            message: mapped.message,
            utmSource: graphLead.platform === 'ig' ? 'ig' : 'fb',
            utmMedium: 'paid_social',
          },
        ),
      );
      await this.prisma.metaLeadReceipt.update({ where: { leadgenId }, data: { leadId: result.leadId } });
      await this.prisma.metaConnection.update({ where: { id: conn.id }, data: { lastLeadAt: new Date(), leadCount: { increment: 1 } } });
    } catch (err) {
      // Not recorded: free the id so Facebook's retry can take it.
      await this.prisma.metaLeadReceipt.delete({ where: { leadgenId } }).catch(() => undefined);
      throw err;
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async own(id: string, companyId: string) {
    const row = await this.prisma.metaConnection.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Facebook page not found');
    return row;
  }

  private async assertRefs(companyId: string, campaignId?: string, projectId?: string) {
    if (campaignId && !(await this.prisma.campaign.findFirst({ where: { id: campaignId, companyId }, select: { id: true } }))) {
      throw new BadRequestException('Campaign not found');
    }
    if (projectId && !(await this.prisma.project.findFirst({ where: { id: projectId, companyId }, select: { id: true } }))) {
      throw new BadRequestException('Project not found');
    }
  }
}
