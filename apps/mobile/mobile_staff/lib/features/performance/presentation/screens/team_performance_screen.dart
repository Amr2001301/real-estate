import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/sales_performance.dart';
import '../cubit/team_performance_cubit.dart';
import '../widgets/period_picker.dart';

// ── KPI color palette matching web admin chart ────────────────────────────────
const _colorLeads = Color(0xFF3B82F6);
const _colorVisits = Color(0xFF8B5CF6);
const _colorReservations = Color(0xFFF59E0B);
const _colorContracts = Color(0xFF22C55E);

class TeamPerformanceScreen extends StatefulWidget {
  const TeamPerformanceScreen({super.key});

  @override
  State<TeamPerformanceScreen> createState() => _TeamPerformanceScreenState();
}

class _TeamPerformanceScreenState extends State<TeamPerformanceScreen> {
  late String _period;

  @override
  void initState() {
    super.initState();
    _period = _currentPeriod();
    context.read<TeamPerformanceCubit>().load(period: _period);
  }

  void _changePeriod(String p) {
    if (p == _period) return;
    setState(() => _period = p);
    context.read<TeamPerformanceCubit>().load(period: p);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<TeamPerformanceCubit>();
    final lang = Localizations.localeOf(context).languageCode;
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.teamPerfTitle,
            compact: true,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
            actions: [
              NavHeaderAction(
                icon: Icons.manage_history_rounded,
                onTap: () => context.push('/team-targets'),
              ),
            ],
          ),
          Expanded(
            child: BlocBuilder<TeamPerformanceCubit, TeamPerformanceState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton(rows: 4);
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                  case DataStatus.success:
                    return RefreshIndicator(
                      color: AppPalette.gold400,
                      onRefresh: () => cubit.load(period: _period),
                      child: CustomScrollView(
                        slivers: [
                          // ── Period picker button ─────────────────────────
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(
                                  AppSpacing.lg, AppSpacing.md,
                                  AppSpacing.lg, AppSpacing.xs),
                              child: _PeriodButton(
                                period: _period,
                                lang: lang,
                                onTap: () async {
                                  final picked = await showPeriodPicker(
                                    context,
                                    initialPeriod: _period,
                                  );
                                  if (picked != null) _changePeriod(picked);
                                },
                              ),
                            ),
                          ),

                          // ── KPI summary ───────────────────────────────────
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(
                                  AppSpacing.lg, AppSpacing.sm,
                                  AppSpacing.lg, AppSpacing.md),
                              child: _KpiGrid(members: state.members, lang: lang),
                            ),
                          ),

                          // ── Section header ────────────────────────────────
                          if (state.members.isNotEmpty)
                            SliverToBoxAdapter(
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(
                                    AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.sm),
                                child: _SectionHeader(
                                  title: l10n.teamPerfDetails,
                                  count: state.members.length,
                                  subtitle: periodLabel(_period, lang),
                                ),
                              ),
                            ),

                          // ── Member cards ──────────────────────────────────
                          if (state.members.isEmpty)
                            SliverFillRemaining(
                              hasScrollBody: false,
                              child: Center(
                                child: Padding(
                                  padding: const EdgeInsets.all(AppSpacing.xl),
                                  child: Text(
                                    l10n.teamPerfEmpty,
                                    textAlign: TextAlign.center,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
                                        ?.copyWith(
                                            color: context.appColors.inkMuted),
                                  ),
                                ),
                              ),
                            )
                          else
                            SliverPadding(
                              padding: EdgeInsets.fromLTRB(
                                AppSpacing.lg,
                                0,
                                AppSpacing.lg,
                                bottomPad + AppSpacing.xl,
                              ),
                              sliver: SliverList.separated(
                                itemCount: state.members.length,
                                separatorBuilder: (_, _) =>
                                    const SizedBox(height: AppSpacing.md),
                                itemBuilder: (context, i) => _MemberCard(
                                  member: state.members[i],
                                  lang: lang,
                                ),
                              ),
                            ),
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

// ── Period picker button ───────────────────────────────────────────────────────

class _PeriodButton extends StatelessWidget {
  const _PeriodButton({
    required this.period,
    required this.lang,
    required this.onTap,
  });
  final String period;
  final String lang;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md, vertical: 10),
          decoration: BoxDecoration(
            color: colors.brandGold.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(AppRadii.pill),
            border: Border.all(
              color: colors.brandGold.withValues(alpha: 0.40),
              width: 1.2,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.calendar_month_rounded,
                  size: 15, color: colors.brandGold),
              const SizedBox(width: AppSpacing.xs),
              Text(
                periodLabel(period, lang),
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: colors.brandGold,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(width: 4),
              Icon(Icons.expand_more_rounded,
                  size: 15, color: colors.brandGold),
            ],
          ),
        ),
      ),
    );
  }
}

// ── KPI grid ───────────────────────────────────────────────────────────────────

class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.members, required this.lang});
  final List<TeamMemberPerformance> members;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    final totalSales = members.fold<double>(
        0, (s, m) => s + m.performance.realizedValue);
    final totalContracts = members.fold<int>(
        0, (s, m) => s + m.performance.signedContractsCount);
    final membersWithTargets =
        members.where((m) => m.performance.hasTarget).toList();
    final avgAchievement = membersWithTargets.isEmpty
        ? null
        : membersWithTargets.fold<double>(
                0, (s, m) => s + (m.performance.targetAmountPercent ?? 0)) /
            membersWithTargets.length;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _KpiTile(
                icon: Icons.trending_up_rounded,
                iconColor: _colorContracts,
                label: l10n.teamPerfTotalSales,
                value: PriceFormatter.format(totalSales, languageCode: lang),
                colors: colors,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _KpiTile(
                icon: Icons.description_rounded,
                iconColor: _colorVisits,
                label: l10n.targetsSignedContracts,
                value: '$totalContracts',
                colors: colors,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: _KpiTile(
                icon: Icons.people_rounded,
                iconColor: _colorLeads,
                label: l10n.teamPerfDetails,
                value: '${members.length}',
                colors: colors,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _KpiTile(
                icon: Icons.track_changes_rounded,
                iconColor: _colorReservations,
                label: l10n.teamPerfAvgAchievement,
                value: avgAchievement == null
                    ? '—'
                    : '${avgAchievement.toStringAsFixed(0)}%',
                colors: colors,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.colors,
  });
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.10),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 18, color: iconColor),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    label,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: colors.inkMuted,
                          fontSize: 10,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}

// ── Section header ─────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.count,
    this.subtitle,
  });
  final String title;
  final int count;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          decoration: BoxDecoration(
            color: AppPalette.gold400,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    title,
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: colors.surfaceSoft,
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      '$count',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: colors.inkMuted,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                ],
              ),
              if (subtitle != null)
                Text(
                  subtitle!,
                  style: Theme.of(context)
                      .textTheme
                      .labelSmall
                      ?.copyWith(color: colors.inkMuted),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Member performance card ────────────────────────────────────────────────────

class _MemberCard extends StatelessWidget {
  const _MemberCard({required this.member, required this.lang});
  final TeamMemberPerformance member;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final p = member.performance;
    final pct = (p.targetAmountPercent ?? 0).clamp(0.0, 100.0);
    final hasTarget = p.hasTarget;
    final barColor = pct >= 100 ? colors.success : colors.brandGold;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Thin top accent strip ─────────────────────────────────────────
          Container(
            height: 3,
            decoration: BoxDecoration(
              color: hasTarget
                  ? barColor.withValues(alpha: 0.55)
                  : colors.hairline,
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppRadii.lg)),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header: avatar + name + chip ─────────────────────────
                Row(
                  children: [
                    _GoldAvatar(name: member.salesName),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            member.salesName,
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            PriceFormatter.format(p.realizedValue,
                                languageCode: lang),
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: colors.brandGold,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ],
                      ),
                    ),
                    if (!hasTarget)
                      _NoTargetChip(colors: colors)
                    else
                      _AchievementChip(pct: pct, colors: colors),
                  ],
                ),

                const SizedBox(height: AppSpacing.md),

                // ── Progress bar + labels ─────────────────────────────────
                ClipRRect(
                  borderRadius: AppRadii.pillAll,
                  child: LinearProgressIndicator(
                    value: hasTarget ? pct / 100 : 0,
                    minHeight: 7,
                    backgroundColor: colors.surfaceSoft,
                    color: hasTarget ? barColor : colors.surfaceSoft,
                  ),
                ),
                if (hasTarget) ...[
                  const SizedBox(height: 5),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        PriceFormatter.format(p.achievedAmount,
                            languageCode: lang),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: barColor.withValues(alpha: 0.8),
                              fontWeight: FontWeight.w600,
                              fontSize: 10,
                            ),
                      ),
                      if (p.targetAmount != null)
                        Text(
                          PriceFormatter.format(p.targetAmount!,
                              languageCode: lang),
                          style: Theme.of(context)
                              .textTheme
                              .labelSmall
                              ?.copyWith(
                                  color: colors.inkMuted, fontSize: 10),
                        ),
                    ],
                  ),
                ],

                const SizedBox(height: AppSpacing.md),
                Divider(height: 1, color: colors.hairline),
                const SizedBox(height: AppSpacing.sm),

                // ── KPI dots spread evenly ────────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _KpiDot(
                        color: _colorLeads,
                        count: p.leadsCount,
                        label: 'فرص'),
                    _KpiDot(
                        color: _colorVisits,
                        count: p.visitsCount,
                        label: 'زيارات'),
                    _KpiDot(
                        color: _colorReservations,
                        count: p.reservationsCount,
                        label: 'حجوزات'),
                    _KpiDot(
                        color: _colorContracts,
                        count: p.signedContractsCount,
                        label: 'عقود'),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GoldAvatar extends StatelessWidget {
  const _GoldAvatar({required this.name});
  final String name;

  static const _gold1 = Color(0xFFAA8528);
  static const _gold2 = Color(0xFFC8A24B);

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().isNotEmpty
        ? name.trim().split(' ').map((w) => w[0]).take(2).join()
        : '?';
    return Container(
      width: 44,
      height: 44,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [_gold1, _gold2],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Text(
          initials,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 15,
          ),
        ),
      ),
    );
  }
}

class _AchievementChip extends StatelessWidget {
  const _AchievementChip({required this.pct, required this.colors});
  final double pct;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    final color = pct >= 100 ? colors.success : colors.brandGold;
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadii.sm),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Text(
        '${pct.toStringAsFixed(0)}%',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _NoTargetChip extends StatelessWidget {
  const _NoTargetChip({required this.colors});
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm, vertical: 4),
        decoration: BoxDecoration(
          color: colors.surfaceSoft,
          borderRadius: BorderRadius.circular(AppRadii.sm),
          border: Border.all(color: colors.hairline),
        ),
        child: Text(
          context.l10n.teamTargetNoTarget,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: colors.inkMuted,
                fontWeight: FontWeight.w600,
              ),
        ),
      );
}

class _KpiDot extends StatelessWidget {
  const _KpiDot({
    required this.color,
    required this.count,
    required this.label,
  });
  final Color color;
  final int count;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 4),
          Text(
            '$count $label',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.appColors.inkMuted,
                  fontSize: 11,
                ),
          ),
        ],
      );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

String _currentPeriod() {
  final now = DateTime.now();
  return '${now.year}-${now.month.toString().padLeft(2, '0')}';
}
