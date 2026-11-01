import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../leads/presentation/follow_up_labels.dart';
import '../domain/campaign.dart';
import 'campaigns_cubit.dart';
import 'campaigns_screen.dart';

String _platformLabel(AppLocalizations l10n, String? p) => switch (p) {
      'FACEBOOK' => l10n.campaignPlatformFacebook,
      'INSTAGRAM' => l10n.campaignPlatformInstagram,
      'MESSENGER' => l10n.campaignPlatformMessenger,
      'AUDIENCE_NETWORK' => l10n.campaignPlatformAudience,
      'OTHER' => l10n.campaignPlatformOther,
      _ => l10n.campaignPlatformUnknown,
    };

/// One campaign: what it cost, what it brought, where its leads came from,
/// and what was spent on it, day by day.
class CampaignDetailScreen extends StatefulWidget {
  const CampaignDetailScreen({super.key, this.row});

  /// The list row, shown while the campaign is read.
  final Campaign? row;

  @override
  State<CampaignDetailScreen> createState() => _CampaignDetailScreenState();
}

class _CampaignDetailScreenState extends State<CampaignDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<CampaignDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<CampaignDetailCubit>();
    return Scaffold(
      body: BlocBuilder<CampaignDetailCubit, CampaignDetailState>(
        builder: (context, state) {
          final c = state.campaign ?? widget.row;
          return Column(
            children: [
              AppNavHeader(
                title: c?.name ?? l10n.campaignsTitle,
                compact: true,
                leadingAction: NavHeaderAction(
                  icon: Icons.arrow_back_ios_new_rounded,
                  onTap: () => context.canPop() ? context.pop() : context.go('/campaigns'),
                ),
              ),
              Expanded(
                child: state.status == DataStatus.failure && c == null
                    ? ErrorState(failure: state.failure, onRetry: cubit.load)
                    : c == null
                        ? const Center(child: CircularProgressIndicator())
                        : RefreshIndicator(onRefresh: cubit.load, child: _Body(campaign: c, full: state.campaign != null)),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.campaign, required this.full});
  final Campaign campaign;

  /// The spend log and platforms are read (not just the list row).
  final bool full;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final c = campaign;
    final s = c.stats;
    final accent = campaignChannelColor(c.channel);
    String day(DateTime? d) => d == null ? '—' : followUpDate(d.toUtc(), lang);
    final rows = <(String, String)>[
      (l10n.campaignChannel, campaignChannelLabel(l10n, c.channel)),
      if (c.projectName != null) (l10n.campaignProject, c.projectName!),
      if (c.sourceName != null) (l10n.campaignSource, c.sourceName!),
      if (c.startsOn != null || c.endsOn != null)
        (
          l10n.campaignPeriod,
          c.endsOn == null
              ? l10n.campaignFrom(day(c.startsOn))
              : c.startsOn == null
                  ? l10n.campaignUntil(day(c.endsOn))
                  : '${day(c.startsOn)} — ${day(c.endsOn)}',
        ),
      if (c.budget != null) (l10n.campaignBudget, campaignMoney(c.budget, lang)),
      if (c.code != null) (l10n.campaignCode, c.code!),
    ];

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, MediaQuery.paddingOf(context).bottom + 40),
      children: [
        // ── What it brought ───────────────────────────────────────────────
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(color: accent.withValues(alpha: 0.12), shape: BoxShape.circle),
                    child: Icon(campaignChannelIcon(c.channel), color: accent, size: 20),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      campaignChannelLabel(l10n, c.channel),
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.inkStrong),
                    ),
                  ),
                  StatusBadge(label: campaignStatusLabel(l10n, c.status), tone: campaignStatusTone(c.status)),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: AppSpacing.xs,
                crossAxisSpacing: AppSpacing.xs,
                childAspectRatio: 1.45,
                children: [
                  _Stat(label: l10n.campaignsLeads, value: latinDigits('${s.leads}')),
                  _Stat(label: l10n.campaignQualified, value: latinDigits('${s.qualified}')),
                  _Stat(label: l10n.campaignsWon, value: latinDigits('${s.won}'), color: colors.success),
                  _Stat(label: l10n.campaignsSpend, value: campaignMoney(s.spend, lang)),
                  _Stat(label: l10n.campaignsCpl, value: campaignMoney(s.cpl, lang)),
                  _Stat(label: l10n.campaignsCpa, value: campaignMoney(s.cpa, lang)),
                ],
              ),
              if (s.lost > 0) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(l10n.campaignLostCount(latinDigits('${s.lost}')), style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // ── The campaign ──────────────────────────────────────────────────
        _Card(
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0) Divider(height: 1, color: colors.hairline),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(width: 110, child: Text(rows[i].$1, style: TextStyle(fontSize: 13, color: colors.inkMuted))),
                      Expanded(
                        child: Text(
                          rows[i].$2,
                          style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: colors.inkStrong),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),

        // ── Where its leads came from ─────────────────────────────────────
        if (full && c.platforms.any((p) => p.platform != null)) ...[
          const SizedBox(height: AppSpacing.md),
          _Title(l10n.campaignPlatforms),
          const SizedBox(height: AppSpacing.xs),
          _Card(
            child: Column(
              children: [
                for (final p in c.platforms)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Expanded(child: Text(_platformLabel(l10n, p.platform), style: TextStyle(fontSize: 13.5, color: colors.ink))),
                        Text(
                          '${l10n.campaignLeadsCount(latinDigits('${p.leads}'))} · ${l10n.campaignWonCount(latinDigits('${p.won}'))}',
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: colors.inkMuted),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],

        // ── What was spent ────────────────────────────────────────────────
        if (full) ...[
          const SizedBox(height: AppSpacing.md),
          _Title(l10n.campaignSpendLog),
          const SizedBox(height: AppSpacing.xs),
          _Card(
            key: const Key('campaign-spend'),
            child: c.spend.isEmpty
                ? Text(l10n.campaignSpendEmpty, style: TextStyle(fontSize: 13, color: colors.inkMuted))
                : Column(
                    children: [
                      for (var i = 0; i < c.spend.length; i++) ...[
                        if (i > 0) Divider(height: 1, color: colors.hairline),
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 9),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(day(c.spend[i].spentOn), style: TextStyle(fontSize: 13, color: colors.inkStrong)),
                                    if (c.spend[i].note != null && c.spend[i].note!.isNotEmpty)
                                      Text(c.spend[i].note!, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                                  ],
                                ),
                              ),
                              Text(
                                campaignMoney(c.spend[i].amount, lang),
                                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        Text(l10n.campaignOnDashboard, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.color});
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(AppRadii.sm)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: colors.inkMuted)),
          const SizedBox(height: 3),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color ?? colors.inkStrong)),
          ),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.card,
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: child,
    );
  }
}

class _Title extends StatelessWidget {
  const _Title(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: context.appColors.inkStrong),
      );
}
