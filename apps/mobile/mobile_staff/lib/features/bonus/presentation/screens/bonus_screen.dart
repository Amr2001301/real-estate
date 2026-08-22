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
    final l10n      = context.l10n;
    final cubit     = context.read<BonusCubit>();
    final isRtl     = context.read<LocaleCubit>().isRtl;
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
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView(
                        padding: EdgeInsets.fromLTRB(
                            AppSpacing.lg, AppSpacing.md,
                            AppSpacing.lg, bottomPad + AppSpacing.xl),
                        children: [
                          _OverviewCard(state: state),
                          const SizedBox(height: AppSpacing.md),
                          _StatusFilter(selected: state.statusFilter),
                          const SizedBox(height: AppSpacing.md),
                          if (state.entries.isNotEmpty) ...[
                            _SectionHeader(label: l10n.bonusTitle),
                            const SizedBox(height: AppSpacing.sm),
                          ],
                          if (state.entries.isEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: AppSpacing.xxl),
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
    final l10n   = context.l10n;
    final colors = context.appColors;
    final lang   = Localizations.localeOf(context).languageCode;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline),
        boxShadow: colors.shadowCard,
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            Expanded(
              child: _Metric(
                label: l10n.bonusPaid,
                value: money(state.overview.paidTotal),
                tone: BadgeTone.success,
              ),
            ),
            VerticalDivider(width: 1, thickness: 1, color: colors.hairline),
            Expanded(
              child: _Metric(
                label: l10n.bonusPending,
                value: money(state.overview.pendingTotal),
                tone: BadgeTone.warning,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value, required this.tone});
  final String label;
  final String value;
  final BadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final accent = tone == BadgeTone.success ? colors.success : colors.warning;
    return Padding(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: accent,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: colors.inkMuted),
          ),
        ],
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
    final l10n  = context.l10n;
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

// ── Filter chip ───────────────────────────────────────────────────────────────

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

// ── Section header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 3, height: 16,
            decoration: BoxDecoration(
              color: AppPalette.gold400,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      );
}

// ── Bonus tile ────────────────────────────────────────────────────────────────

class _BonusTile extends StatelessWidget {
  const _BonusTile({required this.entry});
  final BonusEntry entry;

  Color _toneColor(BadgeTone tone, AppColorsExt c) => switch (tone) {
        BadgeTone.success => c.success,
        BadgeTone.warning => c.warning,
        BadgeTone.info    => c.info,
        _                 => c.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final lang   = Localizations.localeOf(context).languageCode;
    final tone   = bonusStatusTone(entry.status);
    final barColor = _toneColor(tone, colors);

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
                  top: 0, bottom: 0, start: 0,
                  child: Container(width: 4, color: barColor),
                ),
                Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    AppSpacing.md, AppSpacing.md,
                    AppSpacing.md, AppSpacing.md,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              PriceFormatter.formatString(
                                  entry.amount, languageCode: lang),
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: colors.inkStrong,
                                height: 1.2,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              [
                                entry.period,
                                if (entry.ruleName != null) entry.ruleName!,
                              ].join(' · '),
                              style: TextStyle(
                                fontSize: 12,
                                color: colors.inkMuted,
                                height: 1.3,
                              ),
                            ),
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
