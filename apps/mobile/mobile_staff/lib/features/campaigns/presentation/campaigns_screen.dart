import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/staff_list_skeleton.dart';
import '../../dashboard/home_kit/filter_kit.dart';
import '../../dashboard/home_kit/home_kit.dart';
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

  void _filters() {
    final cubit = context.read<CampaignsCubit>();
    showFilterSheet(context, (_) => _StatusSheet(selected: cubit.state.filter, onApply: cubit.setFilter));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<CampaignsCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocBuilder<CampaignsCubit, CampaignsState>(
          builder: (context, state) {
            final ready = state.status == DataStatus.success;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: ListView(
                key: const Key('campaigns'),
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.only(bottom: bottomPad + 100),
                children: [
                  HomeListHero(
                    back: true,
                    title: l10n.campaignsTitle,
                    subtitle: ready ? l10n.campaignsCountN(state.page.items.length) : null,
                    actions: [
                      HomeHeroButton(
                        key: const Key('campaigns-filters'),
                        icon: Icons.tune_rounded,
                        dot: state.filter != null,
                        tooltip: l10n.campaignsFilterTitle,
                        onTap: _filters,
                      ),
                    ],
                  ),
                  ...switch (state.status) {
                    DataStatus.initial || DataStatus.loading => [const SizedBox(height: 480, child: StaffListSkeleton())],
                    DataStatus.failure => [ErrorState(failure: state.failure, onRetry: cubit.load)],
                    DataStatus.empty => [EmptyState(icon: Icons.campaign_outlined, title: l10n.campaignsEmpty, message: l10n.campaignsEmptyHint)],
                    DataStatus.success => [
                        Padding(padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0), child: _Totals(totals: state.page.totals)),
                        for (final c in state.page.items)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                            child: _CampaignTile(campaign: c, onTap: () => context.push('/campaigns/${c.id}', extra: c)),
                          ),
                      ],
                  },
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _StatusSheet extends StatefulWidget {
  const _StatusSheet({required this.selected, required this.onApply});
  final String? selected;
  final ValueChanged<String?> onApply;

  @override
  State<_StatusSheet> createState() => _StatusSheetState();
}

class _StatusSheetState extends State<_StatusSheet> {
  late String? _s = widget.selected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return FilterSheet(
      title: l10n.campaignsFilterTitle,
      active: _s == null ? 0 : 1,
      onClear: () => setState(() => _s = null),
      applyLabel: l10n.campaignsFilterApply,
      onApply: () {
        widget.onApply(_s);
        Navigator.of(context).pop();
      },
      sections: [
        FilterSection(
          icon: Icons.flag_outlined,
          title: l10n.kcStatus,
          child: FilterRadioList<String?>(
            keyPrefix: 'campaign-filter',
            selected: _s,
            onSelect: (v) => setState(() => _s = v),
            options: [
              FilterOption<String?>(null, l10n.leadsFilterAll),
              for (final st in kCampaignStatuses) FilterOption<String?>(st, campaignStatusLabel(l10n, st), color: campaignStatusColor(st, colors)),
            ],
          ),
        ),
      ],
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
    HomeFigure money(String id, num? v, String label, String hint) {
      final (n, u) = homeCompact(v ?? 0, l10n);
      return HomeFigure(id: id, value: ltr(n), label: u.isEmpty ? label : '$label · $u', hint: hint);
    }

    return KeyedSubtree(
      key: const Key('campaigns-totals'),
      child: HomeBand(figures: [
        money('spend', totals.spend, l10n.campaignsSpend, '${l10n.campaignsCpl} ${campaignMoney(totals.cpl, lang)}'),
        HomeFigure(id: 'leads', value: _count(totals.leads), label: l10n.campaignsLeads, hint: campaignMoney(totals.cpl, lang)),
        HomeFigure(id: 'won', value: _count(totals.won), label: l10n.campaignsWon, hint: '${l10n.campaignsCpa} ${campaignMoney(totals.cpa, lang)}'),
      ]),
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
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: colors.hairline),
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
                          color: accent.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(15),
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
                      Icon(AppIcons.chevronForward, color: AppPalette.gold400),
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
            Expanded(child: Text(label, style: TextStyle(fontSize: 12, color: colors.inkMuted))),
            Text(
              '${latinDigits((used * 100).round().toString())}%',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color),
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
