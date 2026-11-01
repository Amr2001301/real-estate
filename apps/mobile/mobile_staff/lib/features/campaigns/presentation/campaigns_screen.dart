import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/staff_list_skeleton.dart';
import '../../leads/presentation/follow_up_labels.dart';
import '../domain/campaign.dart';
import 'campaigns_cubit.dart';

String campaignChannelLabel(AppLocalizations l10n, String channel) => switch (channel) {
      'FACEBOOK' => l10n.campaignChannelFacebook,
      'INSTAGRAM' => l10n.campaignChannelInstagram,
      'TIKTOK' => l10n.campaignChannelTiktok,
      'GOOGLE' => l10n.campaignChannelGoogle,
      'SNAPCHAT' => l10n.campaignChannelSnapchat,
      'WHATSAPP' => l10n.campaignChannelWhatsapp,
      'SMS' => l10n.campaignChannelSms,
      'EMAIL' => l10n.campaignChannelEmail,
      'BILLBOARD' => l10n.campaignChannelBillboard,
      'EVENT' => l10n.campaignChannelEvent,
      _ => l10n.campaignChannelOther,
    };

String campaignStatusLabel(AppLocalizations l10n, String status) => switch (status) {
      'PLANNED' => l10n.campaignStatusPlanned,
      'ACTIVE' => l10n.campaignStatusActive,
      'PAUSED' => l10n.campaignStatusPaused,
      'ENDED' => l10n.campaignStatusEnded,
      _ => status,
    };

BadgeTone campaignStatusTone(String status) => switch (status) {
      'ACTIVE' => BadgeTone.success,
      'PLANNED' => BadgeTone.info,
      'PAUSED' => BadgeTone.warning,
      _ => BadgeTone.neutral,
    };

Color campaignStatusColor(String status, AppColorsExt c) => switch (status) {
      'ACTIVE' => c.success,
      'PLANNED' => c.info,
      'PAUSED' => c.warning,
      _ => c.inkMuted,
    };

/// Each channel's own colour, as on the dashboard.
Color campaignChannelColor(String channel) => switch (channel) {
      'FACEBOOK' => const Color(0xFF1877F2),
      'INSTAGRAM' => const Color(0xFFD62976),
      'TIKTOK' => const Color(0xFF111111),
      'GOOGLE' => const Color(0xFF34A853),
      'SNAPCHAT' => const Color(0xFFE6C800),
      'WHATSAPP' => const Color(0xFF128C7E),
      'SMS' => const Color(0xFF6A1B9A),
      'EMAIL' => const Color(0xFF1565C0),
      'BILLBOARD' => const Color(0xFF8D6E63),
      'EVENT' => const Color(0xFFC8A24B),
      _ => const Color(0xFF6B6256),
    };

IconData campaignChannelIcon(String channel) => switch (channel) {
      'FACEBOOK' || 'INSTAGRAM' || 'TIKTOK' || 'SNAPCHAT' => Icons.campaign_rounded,
      'GOOGLE' => Icons.travel_explore_rounded,
      'WHATSAPP' => Icons.chat_rounded,
      'SMS' => Icons.sms_rounded,
      'EMAIL' => Icons.mail_rounded,
      'BILLBOARD' => Icons.signpost_rounded,
      'EVENT' => Icons.storefront_rounded,
      _ => Icons.campaign_outlined,
    };

String campaignMoney(num? amount, String lang) =>
    amount == null ? '—' : latinDigits(PriceFormatter.format(amount, languageCode: lang));

String _count(int n) => latinDigits(n.toString());

/// MC1 — «الحملات»: what each marketing campaign cost and brought (leads,
/// sales, cost per lead and per sale). Admin and sales manager; set up and
/// costed on the dashboard.
class CampaignsScreen extends StatefulWidget {
  const CampaignsScreen({super.key});

  @override
  State<CampaignsScreen> createState() => _CampaignsScreenState();
}

class _CampaignsScreenState extends State<CampaignsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<CampaignsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<CampaignsCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.campaignsTitle,
            compact: true,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.canPop() ? context.pop() : context.go('/home'),
            ),
          ),
          const _StatusFilter(),
          Expanded(
            child: BlocBuilder<CampaignsCubit, CampaignsState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.campaign_outlined,
                      title: l10n.campaignsEmpty,
                      message: l10n.campaignsEmptyHint,
                    );
                  case DataStatus.success:
                    final items = state.page.items;
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, bottomPad + 100),
                        itemCount: items.length + 1,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) {
                          if (i == 0) return _Totals(totals: state.page.totals);
                          final c = items[i - 1];
                          return _CampaignTile(
                            campaign: c,
                            onTap: () => context.push('/campaigns/${c.id}', extra: c),
                          );
                        },
                      ),
                    );
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── The band over the list: spend, leads, cost per lead, sales, cost per sale ─

class _Totals extends StatelessWidget {
  const _Totals({required this.totals});
  final CampaignStats totals;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    return Container(
      key: const Key('campaigns-totals'),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppPalette.navy, AppPalette.navy700],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: AppRadii.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.campaignsSpend, style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.7))),
          const SizedBox(height: 4),
          Text(
            campaignMoney(totals.spend, lang),
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              _Kpi(label: l10n.campaignsLeads, value: _count(totals.leads)),
              _Kpi(label: l10n.campaignsCpl, value: campaignMoney(totals.cpl, lang)),
              _Kpi(label: l10n.campaignsWon, value: _count(totals.won)),
              _Kpi(label: l10n.campaignsCpa, value: campaignMoney(totals.cpa, lang)),
            ],
          ),
        ],
      ),
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.65))),
            const SizedBox(height: 2),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: AlignmentDirectional.centerStart,
              child: Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppPalette.gold300)),
            ),
          ],
        ),
      );
}

// ── Status filter bar (as on the other staff lists) ───────────────────────────

class _StatusFilter extends StatelessWidget {
  const _StatusFilter();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final cubit = context.read<CampaignsCubit>();
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(bottom: BorderSide(color: colors.hairline, width: 0.5)),
      ),
      child: BlocBuilder<CampaignsCubit, CampaignsState>(
        buildWhen: (a, b) => a.filter != b.filter,
        builder: (context, state) => SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 6),
          child: Row(
            children: [
              _Chip(
                key: const ValueKey('campaign-filter-all'),
                label: l10n.leadsFilterAll,
                active: state.filter == null,
                onTap: () => cubit.setFilter(null),
              ),
              for (final s in kCampaignStatuses) ...[
                const SizedBox(width: AppSpacing.xs),
                _Chip(
                  key: ValueKey('campaign-filter-$s'),
                  label: campaignStatusLabel(l10n, s),
                  active: state.filter == s,
                  dotColor: campaignStatusColor(s, colors),
                  onTap: () => cubit.setFilter(s),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({super.key, required this.label, required this.active, required this.onTap, this.dotColor});
  final String label;
  final bool active;
  final VoidCallback onTap;
  final Color? dotColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm + 4, vertical: 11),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(color: active ? colors.brandNavy : colors.hairline, width: active ? 0 : 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!active && dotColor != null) ...[
              Container(width: 6, height: 6, decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle)),
              const SizedBox(width: AppSpacing.xxs + 2),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                color: active ? Colors.white : colors.inkStrong,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Campaign tile ─────────────────────────────────────────────────────────────

class _CampaignTile extends StatelessWidget {
  const _CampaignTile({required this.campaign, required this.onTap});
  final Campaign campaign;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final c = campaign;
    final accent = campaignChannelColor(c.channel);
    final used = c.budgetUsed;

    return GestureDetector(
      key: ValueKey('campaign-${c.id}'),
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadii.card,
          border: Border.all(color: accent.withValues(alpha: 0.16), width: 0.9),
          boxShadow: [
            BoxShadow(color: accent.withValues(alpha: 0.08), blurRadius: 20, offset: const Offset(0, 6)),
            BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0, 2)),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 3,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: isRtl ? Alignment.centerRight : Alignment.centerLeft,
                  end: isRtl ? Alignment.centerLeft : Alignment.centerRight,
                  colors: [accent, accent.withValues(alpha: 0.0)],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.md, 13, AppSpacing.md, 13),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: accent.withValues(alpha: 0.10),
                          shape: BoxShape.circle,
                          border: Border.all(color: accent.withValues(alpha: 0.28), width: 1.2),
                        ),
                        child: Icon(campaignChannelIcon(c.channel), color: accent, size: 22),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              c.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: colors.inkStrong, height: 1.2),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              [campaignChannelLabel(l10n, c.channel), if (c.projectName != null) c.projectName!].join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 12.5, color: colors.inkMuted),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      StatusBadge(label: campaignStatusLabel(l10n, c.status), tone: campaignStatusTone(c.status)),
                      Icon(isRtl ? Icons.chevron_left_rounded : Icons.chevron_right_rounded, color: colors.inkMuted),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      _InfoChip(icon: Icons.people_alt_outlined, text: l10n.campaignLeadsCount(_count(c.stats.leads))),
                      _InfoChip(icon: Icons.handshake_outlined, text: l10n.campaignWonCount(_count(c.stats.won))),
                      _InfoChip(icon: Icons.payments_outlined, text: campaignMoney(c.stats.spend, lang)),
                      if (c.stats.cpl != null)
                        _InfoChip(icon: Icons.person_search_outlined, text: '${l10n.campaignsCpl} ${campaignMoney(c.stats.cpl, lang)}'),
                    ],
                  ),
                  if (used != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    _BudgetBar(used: used, label: l10n.campaignBudgetOf(campaignMoney(c.budget, lang))),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BudgetBar extends StatelessWidget {
  const _BudgetBar({required this.used, required this.label});
  final double used;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final over = used > 1;
    final color = over ? colors.error : (used > 0.85 ? colors.warning : AppPalette.gold500);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text(label, style: TextStyle(fontSize: 11.5, color: colors.inkMuted))),
            Text(
              '${latinDigits((used * 100).round().toString())}%',
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: used.clamp(0, 1).toDouble(),
            minHeight: 5,
            color: color,
            backgroundColor: colors.surfaceSoft,
          ),
        ),
      ],
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: AppRadii.pillAll),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: colors.inkMuted),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.ink)),
        ],
      ),
    );
  }
}
