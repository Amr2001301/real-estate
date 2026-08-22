import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/bonus_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/bonus_entry.dart';
import '../cubit/bonus_cubit.dart';

const _bonusStatuses = ['PENDING', 'APPROVED', 'PAID'];

class BonusScreen extends StatefulWidget {
  const BonusScreen({super.key});

  @override
  State<BonusScreen> createState() => _BonusScreenState();
}

class _BonusScreenState extends State<BonusScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BonusCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BonusCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.bonusTitle,
            compact: true,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          Expanded(
            child: BlocBuilder<BonusCubit, BonusState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(
                        failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                  case DataStatus.success:
                    return RefreshIndicator(
                      color: AppPalette.gold400,
                      onRefresh: cubit.load,
                      child: ListView(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.md,
                          AppSpacing.lg,
                          bottomPad + AppSpacing.xl,
                        ),
                        children: [
                          _OverviewCard(state: state),
                          const SizedBox(height: AppSpacing.md),
                          _StatusFilter(selected: state.statusFilter),
                          const SizedBox(height: AppSpacing.md),
                          if (state.entries.isEmpty)
                            Padding(
                              padding:
                                  const EdgeInsets.only(top: AppSpacing.xxl),
                              child: EmptyState(
                                icon: Icons.payments_outlined,
                                title: l10n.bonusEmptyTitle,
                                message: l10n.bonusEmptyMessage,
                              ),
                            )
                          else
                            for (final e in state.entries) ...[
                              _BonusTile(entry: e),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                        ],
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

// ── Overview card ─────────────────────────────────────────────────────────────

class _OverviewCard extends StatelessWidget {
  const _OverviewCard({required this.state});
  final BonusState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);

    return PremiumCard(
      elevation: AppCardElevation.soft,
      accentRail: AppTone.gold,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              const IconChip(
                icon: Icons.account_balance_wallet_rounded,
                tone: AppTone.gold,
                size: IconChipSize.sm,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  l10n.bonusTitle,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          // Metric cells
          Row(
            children: [
              _MetricCell(
                label: l10n.bonusPaid,
                value: money(state.overview.paidTotal),
                icon: Icons.check_circle_rounded,
                color: colors.success,
              ),
              const SizedBox(width: AppSpacing.sm),
              _MetricCell(
                label: l10n.bonusPending,
                value: money(state.overview.pendingTotal),
                icon: Icons.hourglass_top_rounded,
                color: colors.warning,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricCell extends StatelessWidget {
  const _MetricCell({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: AppSpacing.sm + 2),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: color,
                      letterSpacing: -0.3,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    label,
                    style: Theme.of(context)
                        .textTheme
                        .labelSmall
                        ?.copyWith(color: colors.inkMuted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Status filter ─────────────────────────────────────────────────────────────

class _StatusFilter extends StatelessWidget {
  const _StatusFilter({this.selected});
  final String? selected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BonusCubit>();

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _FilterChip(
            label: l10n.leadsFilterAll,
            active: selected == null,
            onTap: () => cubit.setStatus(null),
          ),
          for (final s in _bonusStatuses) ...[
            const SizedBox(width: AppSpacing.xs),
            _FilterChip(
              label: bonusStatusLabel(l10n, s),
              active: selected == s,
              onTap: () => cubit.setStatus(s),
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm + 4, vertical: 8),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(
            color: active ? colors.brandNavy : colors.hairline,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: active ? FontWeight.w700 : FontWeight.w600,
            color: active ? Colors.white : colors.inkStrong,
            height: 1.2,
          ),
        ),
      ),
    );
  }
}

// ── Bonus tile ────────────────────────────────────────────────────────────────

class _BonusTile extends StatelessWidget {
  const _BonusTile({required this.entry});
  final BonusEntry entry;

  Color _toneColor(BadgeTone tone, AppColorsExt c) => switch (tone) {
        BadgeTone.success => c.success,
        BadgeTone.warning => c.warning,
        BadgeTone.info => c.info,
        _ => c.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final tone = bonusStatusTone(entry.status);
    final barColor = _toneColor(tone, colors);
    final date = entry.paidAt ?? entry.createdAt;

    // Build subtitle parts
    final subtitleParts = [
      entry.period,
      if (entry.ruleName != null) entry.ruleName!,
      if (entry.commissionPct != null) '${entry.commissionPct}%',
    ];

    return Container(
      decoration: BoxDecoration(
        borderRadius: AppRadii.card,
        boxShadow: colors.shadowCard,
      ),
      child: ClipRRect(
        borderRadius: AppRadii.card,
        child: Material(
          color: colors.surface,
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(color: colors.hairline, width: 0.5),
              borderRadius: AppRadii.card,
            ),
            child: Stack(
              children: [
                PositionedDirectional(
                  top: 0,
                  bottom: 0,
                  start: 0,
                  child: Container(width: 4, color: barColor),
                ),
                Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    AppSpacing.md + 4,
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.md,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              PriceFormatter.formatString(entry.amount,
                                  languageCode: lang),
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: colors.inkStrong,
                                letterSpacing: -0.3,
                                height: 1.2,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              subtitleParts.join(' · '),
                              style: TextStyle(
                                fontSize: 12,
                                color: colors.inkMuted,
                                height: 1.3,
                              ),
                            ),
                            if (date != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                DateFormatter.shortDate(date,
                                    languageCode: lang),
                                style: Theme.of(context)
                                    .textTheme
                                    .labelSmall
                                    ?.copyWith(color: colors.inkMuted),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      StatusBadge(
                        label: bonusStatusLabel(l10n, entry.status),
                        tone: tone,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
