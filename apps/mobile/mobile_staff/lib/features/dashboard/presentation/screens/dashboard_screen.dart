import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../bonus/presentation/cubit/bonus_summary_cubit.dart';
import '../../../catalog/domain/entities/staff_project.dart';
import '../../../catalog/presentation/cubit/staff_projects_cubit.dart';
import '../../../notifications/presentation/widgets/notifications_bell.dart';
import '../../../performance/presentation/cubit/target_summary_cubit.dart';
import '../../domain/entities/sales_dashboard.dart';
import '../cubit/dashboard_cubit.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, this.onSwitchTab});
  final void Function(int)? onSwitchTab;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    context.read<DashboardCubit>().load();
    context.read<BonusSummaryCubit>().load();
    context.read<TargetSummaryCubit>().load();
    context.read<StaffProjectsCubit>().load();
  }

  Future<void> _refresh() {
    context.read<BonusSummaryCubit>().load();
    context.read<TargetSummaryCubit>().load();
    context.read<StaffProjectsCubit>().load();
    return context.read<DashboardCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.read<SessionCubit>().state.sessionOrNull;
    final mq = MediaQuery.of(context);
    final topPad = mq.padding.top;
    final bottomPad = mq.padding.bottom;

    // AnnotatedRegion keeps status-bar icons white for the lifetime of this
    // screen — even after the header scrolls away and the pinned backdrop
    // (SliverPersistentHeader below) is the only navy element on screen.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<DashboardCubit, DashboardState>(
          builder: (context, state) {
            return RefreshIndicator(
              onRefresh: _refresh,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  // Single unified header: expands to the full branded header,
                  // collapses to a compact mini-header. Owns the safe-area zone
                  // so there is never a separate status-bar strip above it.
                  SliverPersistentHeader(
                    pinned: true,
                    delegate: _DashboardHeaderDelegate(
                      topPad: topPad,
                      name: session?.displayName,
                      l10n: l10n,
                    ),
                  ),
                  if (state.status == DataStatus.initial ||
                      state.status == DataStatus.loading)
                    SliverToBoxAdapter(
                      child: _DashboardSkeleton(bottomPad: bottomPad),
                    )
                  else if (state.status == DataStatus.failure)
                    SliverFillRemaining(
                      child: ErrorState(
                        failure: state.failure,
                        onRetry: () => context.read<DashboardCubit>().load(),
                      ),
                    )
                  else
                    SliverToBoxAdapter(
                      child: _DashboardBody(
                        data: state.data!,
                        bottomPad: bottomPad,
                        onSwitchTab: widget.onSwitchTab,
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _RoleChip extends StatelessWidget {
  const _RoleChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppPalette.gold400, AppPalette.gold500],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.35),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: AppPalette.navy,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _DateChip extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final lang = Localizations.localeOf(context).languageCode;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        _formatDate(now, lang),
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.80),
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  static String _formatDate(DateTime d, String lang) {
    const ar = [
      '',
      'يناير',
      'فبراير',
      'مارس',
      'إبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ];
    const en = [
      '',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return lang == 'ar' ? '${d.day} ${ar[d.month]}' : '${en[d.month]} ${d.day}';
  }
}

class _DotPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..style = PaintingStyle.fill;
    const spacing = 20.0;
    const radius = 1.3;
    for (double x = 0; x < size.width + spacing; x += spacing) {
      for (double y = 0; y < size.height + spacing; y += spacing) {
        canvas.drawCircle(Offset(x, y), radius, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter _) => false;
}

// ── Dashboard body ─────────────────────────────────────────────────────────────

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.data, required this.bottomPad, this.onSwitchTab});
  final SalesDashboard data;
  final double bottomPad;
  final void Function(int)? onSwitchTab;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = context.read<SessionCubit>().state.role;
    final canReviewPayments =
        role == AppRole.admin || role == AppRole.salesManager;
    final canManageSales =
        role == AppRole.admin || role == AppRole.salesManager;
    final lang = Localizations.localeOf(context).languageCode;

    final maxCount = kLeadStages
        .map((s) => data.pipeline[s] ?? 0)
        .fold<int>(1, (m, v) => v > m ? v : m);

    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        bottomPad + 48,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── 1. KPI hero ───────────────────────────────────────────────
          _DarkKpiCard(data: data, l10n: l10n),
          const SizedBox(height: AppSpacing.lg),

          // ── 2. Today's priorities ─────────────────────────────────────
          AppSectionHeader(title: l10n.dashboardTodayFocus),
          const SizedBox(height: AppSpacing.xs),
          _FocusSection(data: data, l10n: l10n, lang: lang, onSwitchTab: onSwitchTab),
          const SizedBox(height: AppSpacing.lg),

          // ── 3. Quick actions ──────────────────────────────────────────
          AppSectionHeader(title: l10n.dashboardQuickActions),
          const SizedBox(height: AppSpacing.xs),
          _CompactQuickActions(
            l10n: l10n,
            canReviewPayments: canReviewPayments,
            canManageSales: canManageSales,
          ),
          const SizedBox(height: AppSpacing.lg),

          // ── 4. Suggested properties ───────────────────────────────────
          AppSectionHeader(title: l10n.dashboardSuggestedProperties),
          const SizedBox(height: AppSpacing.xs),
          _SuggestedPropertiesSection(lang: lang),
          const SizedBox(height: AppSpacing.lg),

          // ── 5. Sales pipeline ─────────────────────────────────────────
          AppSectionHeader(title: l10n.dashboardPipeline),
          const SizedBox(height: AppSpacing.xs),
          _PipelineCard(data: data, maxCount: maxCount, l10n: l10n),
          const SizedBox(height: AppSpacing.lg),

          // ── 6. Monthly performance ────────────────────────────────────
          AppSectionHeader(title: l10n.dashboardMonthlyPerformance),
          const SizedBox(height: AppSpacing.xs),
          _PerformanceDarkModule(l10n: l10n, lang: lang),
        ],
      ),
    );
  }
}

// ── 1. Dark KPI hero card ─────────────────────────────────────────────────────

class _DarkKpiCard extends StatelessWidget {
  const _DarkKpiCard({required this.data, required this.l10n});
  final SalesDashboard data;
  final AppLocalizations l10n;

  static const _bg1 = Color(0xFF1C3352);
  static const _bg2 = Color(0xFF0F1E33);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_bg1, _bg2],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: AppRadii.card,
        boxShadow: const [
          BoxShadow(
            color: Color(0x500F1E33),
            blurRadius: 22,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: AppRadii.card,
              child: CustomPaint(painter: _DotPatternPainter()),
            ),
          ),
          PositionedDirectional(
            top: -20,
            end: -20,
            child: Container(
              width: 120,
              height: 120,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0x1EC8A24B), Color(0x00C8A24B)],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      l10n.dashboardTodaySnapshot,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.65),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.4,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: AppPalette.gold400.withValues(alpha: 0.45),
                        ),
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.circle,
                            size: 6,
                            color: AppPalette.gold300,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            l10n.targetsActivity,
                            style: const TextStyle(
                              color: AppPalette.gold300,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Container(
                  height: 1,
                  color: Colors.white.withValues(alpha: 0.10),
                ),
                const SizedBox(height: AppSpacing.sm),
                IntrinsicHeight(
                  child: Row(
                    children: [
                      _DarkMetric(
                        value: '${data.todayVisits}',
                        label: l10n.dashboardTodayVisits,
                        isGold: true,
                        onTap: () => context.push('/visits?today=1'),
                      ),
                      _DarkDivider(),
                      _DarkMetric(
                        value: '${data.scheduledVisits}',
                        label: l10n.dashboardScheduledVisits,
                        onTap: () => context.push('/visits'),
                      ),
                      _DarkDivider(),
                      _DarkMetric(
                        value: '${data.reservations}',
                        label: l10n.dashboardReservations,
                        onTap: () => context.push('/reservations'),
                      ),
                      _DarkDivider(),
                      _DarkMetric(
                        value: '${data.totalLeads}',
                        label: l10n.dashboardLeads,
                        onTap: () => context.push('/leads'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DarkMetric extends StatelessWidget {
  const _DarkMetric({
    required this.value,
    required this.label,
    this.isGold = false,
    this.onTap,
  });
  final String value;
  final String label;
  final bool isGold;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 30,
                fontWeight: FontWeight.w800,
                height: 1.0,
                color: isGold ? AppPalette.gold300 : Colors.white,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: Colors.white.withValues(alpha: 0.55),
                height: 1.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DarkDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      margin: const EdgeInsets.symmetric(vertical: 4),
      color: Colors.white.withValues(alpha: 0.12),
    );
  }
}

// ── 2. Today's priorities ─────────────────────────────────────────────────────

class _FocusSection extends StatelessWidget {
  const _FocusSection({
    required this.data,
    required this.l10n,
    required this.lang,
    this.onSwitchTab,
  });
  final SalesDashboard data;
  final AppLocalizations l10n;
  final String lang;
  final void Function(int)? onSwitchTab;

  List<_FocusData> _items(BuildContext context) {
    final items = <_FocusData>[];

    if (data.todayVisits > 0) {
      final n = data.todayVisits;
      items.add(
        _FocusData(
          icon: Icons.event_available_outlined,
          label: lang == 'ar'
              ? (n == 1 ? 'زيارة واحدة مجدولة اليوم' : '$n زيارات مجدولة اليوم')
              : (n == 1 ? '1 visit scheduled today' : '$n visits today'),
          chipLabel: lang == 'ar' ? 'اليوم' : 'Today',
          tone: AppTone.gold,
          onTap: () => context.push('/visits'),
        ),
      );
    }

    final neg = data.pipeline['NEGOTIATION'] ?? 0;
    if (neg > 0) {
      items.add(
        _FocusData(
          icon: Icons.handshake_outlined,
          label: lang == 'ar'
              ? (neg == 1 ? 'عميل واحد في مرحلة التفاوض' : '$neg عملاء في التفاوض')
              : (neg == 1 ? '1 client in negotiation' : '$neg clients in negotiation'),
          chipLabel: lang == 'ar' ? 'تفاوض' : 'Negotiation',
          tone: AppTone.warning,
          onTap: () => onSwitchTab?.call(1),
        ),
      );
    }

    final interested = data.pipeline['INTERESTED'] ?? 0;
    if (interested > 0) {
      items.add(
        _FocusData(
          icon: Icons.person_search_outlined,
          label: lang == 'ar'
              ? (interested == 1 ? 'عميل مهتم يحتاج متابعة' : '$interested عملاء مهتمون يحتاجون متابعة')
              : (interested == 1 ? '1 interested lead needs follow-up' : '$interested leads need follow-up'),
          chipLabel: lang == 'ar' ? 'مهتم' : 'Interested',
          tone: AppTone.navy,
          onTap: () => context.push('/leads'),
        ),
      );
    }

    if (items.isEmpty) {
      items.add(
        _FocusData(
          icon: Icons.check_circle_outline,
          label: l10n.dashboardFocusAllClear,
          chipLabel: lang == 'ar' ? 'جيد' : 'Good',
          tone: AppTone.success,
        ),
      );
    }

    return items;
  }

  @override
  Widget build(BuildContext context) {
    final items = _items(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (int i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.xs),
          _FocusItemCard(item: items[i]),
        ],
      ],
    );
  }
}

class _FocusData {
  const _FocusData({
    required this.icon,
    required this.label,
    required this.chipLabel,
    required this.tone,
    this.onTap,
  });
  final IconData icon;
  final String label;
  final String chipLabel;
  final AppTone tone;
  final VoidCallback? onTap;
}

class _FocusItemCard extends StatefulWidget {
  const _FocusItemCard({required this.item});
  final _FocusData item;

  @override
  State<_FocusItemCard> createState() => _FocusItemCardState();
}

class _FocusItemCardState extends State<_FocusItemCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final toneColor = widget.item.tone.baseColor(colors);
    final hasAction = widget.item.onTap != null;
    final isRtl = context.read<LocaleCubit>().isRtl;

    return GestureDetector(
      onTapDown: hasAction ? (_) => setState(() => _pressed = true) : null,
      onTapUp: hasAction ? (_) => setState(() => _pressed = false) : null,
      onTapCancel: hasAction ? () => setState(() => _pressed = false) : null,
      onTap: hasAction ? () => widget.item.onTap!() : null,
      child: AnimatedScale(
        scale: _pressed ? 0.98 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            14,
            AppSpacing.md,
            14,
          ),
          decoration: BoxDecoration(
            color: toneColor.withValues(alpha: 0.055),
            border: Border.all(
              color: toneColor.withValues(alpha: 0.22),
              width: 1.0,
            ),
            borderRadius: AppRadii.card,
            boxShadow: [
              BoxShadow(
                color: toneColor.withValues(alpha: 0.06),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: toneColor.withValues(alpha: 0.12),
                  borderRadius: const BorderRadius.all(Radius.circular(14)),
                ),
                child: Icon(widget.item.icon, color: toneColor, size: 22),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.item.label,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: colors.inkStrong,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: toneColor.withValues(alpha: 0.10),
                        border: Border.all(
                          color: toneColor.withValues(alpha: 0.30),
                        ),
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Text(
                        widget.item.chipLabel,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: toneColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (hasAction) ...[
                const SizedBox(width: AppSpacing.xs),
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: toneColor.withValues(alpha: 0.10),
                    border: Border.all(
                      color: toneColor.withValues(alpha: 0.22),
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.chevron_right_rounded,
                    color: toneColor,
                    size: 18,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── 3. Quick actions — unified grid ───────────────────────────────────────────

class _CompactQuickActions extends StatelessWidget {
  const _CompactQuickActions({
    required this.l10n,
    required this.canReviewPayments,
    required this.canManageSales,
  });
  final AppLocalizations l10n;
  final bool canReviewPayments;
  final bool canManageSales;

  @override
  Widget build(BuildContext context) {
    return _SecondaryActionsGrid(
      l10n: l10n,
      canReviewPayments: canReviewPayments,
      canManageSales: canManageSales,
    );
  }
}

// Full-width primary action cell with gold gradient (replaces the heavy banner card)
class _PrimaryActionCell extends StatefulWidget {
  const _PrimaryActionCell({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  State<_PrimaryActionCell> createState() => _PrimaryActionCellState();
}

class _PrimaryActionCellState extends State<_PrimaryActionCell> {
  bool _pressed = false;

  static const _gold1 = Color(0xFFAA8528);
  static const _gold2 = Color(0xFFC8A24B);

  @override
  Widget build(BuildContext context) {
    final isRtl = context.read<LocaleCubit>().isRtl;
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [_gold1, _gold2],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            borderRadius: BorderRadius.circular(AppRadii.md),
            boxShadow: [
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.32),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(widget.icon, color: Colors.white, size: 17),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                widget.label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Icon(
                Icons.chevron_right_rounded,
                color: Colors.white.withValues(alpha: 0.75),
                size: 18,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SecondaryActionsGrid extends StatelessWidget {
  const _SecondaryActionsGrid({
    required this.l10n,
    required this.canReviewPayments,
    required this.canManageSales,
  });
  final AppLocalizations l10n;
  final bool canReviewPayments;
  final bool canManageSales;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Primary action — full width, gold accent
        _PrimaryActionCell(
          icon: Icons.bookmark_add_outlined,
          label: l10n.reservationNew,
          onTap: () => context.push('/reservations/new'),
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: _SecondaryActionCell(
                icon: Icons.event_outlined,
                label: l10n.visitNew,
                onTap: () => context.push('/visits/new'),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _SecondaryActionCell(
                icon: Icons.calculate_outlined,
                label: l10n.calculatorTitle,
                onTap: () => context.push('/calculator'),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: _SecondaryActionCell(
                icon: Icons.track_changes_outlined,
                label: l10n.targetsTitle,
                onTap: () => context.push('/targets'),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _SecondaryActionCell(
                icon: Icons.payments_outlined,
                label: l10n.bonusTitle,
                onTap: () => context.push('/bonus'),
              ),
            ),
          ],
        ),
        if (canReviewPayments) ...[
          const SizedBox(height: AppSpacing.sm),
          _SecondaryActionCell(
            icon: Icons.receipt_long_outlined,
            label: l10n.paymentReviewTitle,
            onTap: () => context.push('/payments-review'),
          ),
        ],
        if (canManageSales) ...[
          const SizedBox(height: AppSpacing.md),
          _ManagerSectionDivider(),
          const SizedBox(height: AppSpacing.sm),
          _ManagerActionCell(
            icon: Icons.groups_rounded,
            label: 'أداء فريق المبيعات',
            subtitle: 'متابعة أداء المندوبين وإنجازاتهم',
            onTap: () => context.push('/team-performance'),
          ),
          const SizedBox(height: AppSpacing.sm),
          _ManagerActionCell(
            icon: Icons.flag_rounded,
            label: 'إدارة أهداف المبيعات',
            subtitle: 'تحديد الأهداف الشهرية للفريق',
            onTap: () => context.push('/team-targets'),
          ),
        ],
      ],
    );
  }
}

class _SecondaryActionCell extends StatefulWidget {
  const _SecondaryActionCell({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  State<_SecondaryActionCell> createState() => _SecondaryActionCellState();
}

class _SecondaryActionCellState extends State<_SecondaryActionCell> {
  bool _pressed = false;

  static const _gold1 = Color(0xFFAA8528);
  static const _gold2 = Color(0xFFC8A24B);

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.95 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        child: Container(
          height: 96,
          decoration: BoxDecoration(
            color: colors.surface,
            border: Border.all(
              color: AppPalette.gold400.withValues(alpha: 0.18),
              width: 1.0,
            ),
            borderRadius: BorderRadius.circular(AppRadii.lg),
            boxShadow: [
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.08),
                blurRadius: 12,
                offset: const Offset(0, 3),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [_gold1, _gold2],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(13),
                  boxShadow: [
                    BoxShadow(
                      color: AppPalette.gold400.withValues(alpha: 0.35),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Icon(widget.icon, size: 20, color: Colors.white),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
                child: Text(
                  widget.label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: colors.inkStrong,
                    letterSpacing: -0.1,
                    height: 1.3,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Manager section divider ────────────────────────────────────────────────────

class _ManagerSectionDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Expanded(child: Divider(height: 1, color: colors.hairline)),
        const SizedBox(width: AppSpacing.sm),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: AppPalette.gold400.withValues(alpha: 0.09),
            borderRadius: BorderRadius.circular(99),
            border: Border.all(
              color: AppPalette.gold400.withValues(alpha: 0.25),
              width: 0.8,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.manage_accounts_rounded,
                  size: 12, color: AppPalette.gold400),
              const SizedBox(width: 4),
              Text(
                'إدارة الفريق',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: AppPalette.gold400,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(child: Divider(height: 1, color: colors.hairline)),
      ],
    );
  }
}

// ── Manager action cell (full-width horizontal premium card) ───────────────────

class _ManagerActionCell extends StatelessWidget {
  const _ManagerActionCell({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return PremiumCard(
      elevation: AppCardElevation.soft,
      accentRail: AppTone.gold,
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: AppSpacing.sm + 4),
      child: Row(
        children: [
          IconChip(
            icon: icon,
            tone: AppTone.gold,
            size: IconChipSize.sm,
            filled: true,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: colors.inkStrong,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 11,
                    color: colors.inkMuted,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Icon(Icons.chevron_right_rounded,
              size: 18, color: colors.inkMuted.withValues(alpha: 0.6)),
        ],
      ),
    );
  }
}

// ── 4. Suggested real-estate properties ───────────────────────────────────────
// Dynamic card width: one card is fully visible + ~40px peek of the next,
// regardless of device screen width.

class _SuggestedPropertiesSection extends StatelessWidget {
  const _SuggestedPropertiesSection({required this.lang});
  final String lang;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<StaffProjectsCubit, StaffProjectsState>(
      builder: (context, state) {
        if (state.status == DataStatus.loading ||
            state.status == DataStatus.initial) {
          return _ProjectCardsSkeleton();
        }
        final projects = state.projects
            .where((p) => p.status == 'PUBLISHED')
            .take(6)
            .toList();
        if (projects.isEmpty) return const SizedBox.shrink();

        // availableWidth = screen width minus the parent horizontal padding (2×md).
        // 52 = separator(12) + peek(40). No upper clamp so peek stays ~40px on
        // large phones (a 320 cap caused ~76px peek on 430pt devices).
        final availableWidth =
            MediaQuery.of(context).size.width - AppSpacing.md * 2;
        final cardWidth = (availableWidth - 52.0).clamp(220.0, double.infinity);

        return SizedBox(
          height: 245,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            // Trailing padding lets the last card separate cleanly from the edge.
            padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
            itemCount: projects.length,
            separatorBuilder: (context, i) =>
                const SizedBox(width: AppSpacing.sm),
            itemBuilder: (context, i) => _PropertyCard(
              project: projects[i],
              lang: lang,
              width: cardWidth,
            ),
          ),
        );
      },
    );
  }
}

class _PropertyCard extends StatefulWidget {
  const _PropertyCard({
    required this.project,
    required this.lang,
    required this.width,
  });
  final StaffProject project;
  final String lang;
  final double width;

  @override
  State<_PropertyCard> createState() => _PropertyCardState();
}

class _PropertyCardState extends State<_PropertyCard> {
  bool _pressed = false;

  static const _gold1 = Color(0xFFAA8528);
  static const _gold2 = Color(0xFFC8A24B);

  @override
  Widget build(BuildContext context) {
    final p = widget.project;
    final lang = widget.lang;
    final name = p.name.resolve(lang);
    final available = p.availableUnitsCount;
    final hasImage = p.coverImageUrl != null && p.coverImageUrl!.isNotEmpty;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => context.push('/projects/${p.id}'),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOutCubic,
        child: Container(
          width: widget.width,
          decoration: BoxDecoration(
            color: const Color(0xFF1C3352),
            borderRadius: AppRadii.card,
            boxShadow: [
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.12),
                blurRadius: 20,
                offset: const Offset(0, 6),
              ),
              const BoxShadow(
                color: Color(0x55000000),
                blurRadius: 8,
                offset: Offset(0, 3),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Background image
              if (hasImage)
                Image.network(
                  p.coverImageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => const _ProjectCardPlaceholder(),
                )
              else
                const _ProjectCardPlaceholder(),

              // Deep multi-stop gradient — clear image at top, opaque at bottom
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x00000000),
                      Color(0x1A000000),
                      Color(0x99000000),
                      Color(0xEE050E18),
                    ],
                    stops: [0.0, 0.38, 0.65, 1.0],
                  ),
                ),
              ),

              // Gold shimmer hairline at bottom edge
              const Positioned(
                bottom: 0, left: 0, right: 0,
                child: SizedBox(
                  height: 1,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.transparent,
                          Color(0x55C8A24B),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // Availability badge — top start corner
              PositionedDirectional(
                top: AppSpacing.sm,
                start: AppSpacing.sm,
                child: _AvailabilityBadge(available: available, lang: lang),
              ),

              // Info panel — bottom
              PositionedDirectional(
                start: 0,
                end: 0,
                bottom: 0,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Project name
                      Text(
                        name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          height: 1.25,
                          letterSpacing: -0.3,
                          shadows: [
                            Shadow(color: Color(0x88000000), blurRadius: 6),
                          ],
                        ),
                      ),

                      const SizedBox(height: 5),

                      // City + price row
                      Row(
                        children: [
                          if (p.city != null) ...[
                            Icon(
                              Icons.location_on_rounded,
                              size: 11,
                              color: Colors.white.withValues(alpha: 0.55),
                            ),
                            const SizedBox(width: 2),
                            Text(
                              p.city!,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.55),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              width: 3,
                              height: 3,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.30),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 8),
                          ],
                          if (p.startingPrice != null)
                            Expanded(
                              child: Text(
                                (lang == 'ar' ? 'من ' : 'From ') +
                                    PriceFormatter.format(
                                      p.startingPrice!,
                                      languageCode: lang,
                                    ),
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: _gold2,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                        ],
                      ),

                      const SizedBox(height: 10),

                      // Compact gold CTA pill
                      Container(
                        height: 36,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [_gold1, _gold2],
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                          ),
                          borderRadius: BorderRadius.circular(AppRadii.md),
                          boxShadow: [
                            BoxShadow(
                              color: _gold1.withValues(alpha: 0.40),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              lang == 'ar' ? 'استعراض المشروع' : 'View Project',
                              style: const TextStyle(
                                color: Color(0xFF0B1726),
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.1,
                              ),
                            ),
                            const SizedBox(width: 5),
                            const Icon(
                              Icons.arrow_forward_ios_rounded,
                              size: 11,
                              color: Color(0xFF0B1726),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AvailabilityBadge extends StatelessWidget {
  const _AvailabilityBadge({required this.available, required this.lang});
  final int? available;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final hasAvailable = (available ?? 0) > 0;
    final label = hasAvailable
        ? (lang == 'ar' ? '$available متاح' : '$available avail.')
        : (lang == 'ar' ? 'مباع بالكامل' : 'Sold out');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.50),
        border: Border.all(
          color: hasAvailable
              ? AppPalette.successLight.withValues(alpha: 0.55)
              : Colors.white.withValues(alpha: 0.25),
          width: 0.8,
        ),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: hasAvailable ? AppPalette.successLight : Colors.white54,
              shape: BoxShape.circle,
              boxShadow: hasAvailable
                  ? [
                      BoxShadow(
                        color: AppPalette.successLight.withValues(alpha: 0.60),
                        blurRadius: 4,
                      ),
                    ]
                  : null,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: hasAvailable ? AppPalette.successLight : Colors.white70,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProjectCardPlaceholder extends StatelessWidget {
  const _ProjectCardPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF243F62), Color(0xFF0F1E33)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: const Center(
        child: Icon(
          Icons.apartment_rounded,
          color: Color(0x44FFFFFF),
          size: 48,
        ),
      ),
    );
  }
}

class _ProjectCardsSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 245,
      child: AppSkeletonizer(
        enabled: true,
        child: Row(
          children: [
            for (int i = 0; i < 2; i++) ...[
              if (i > 0) const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF1C3352),
                    borderRadius: AppRadii.card,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── 5. Sales pipeline ─────────────────────────────────────────────────────────

class _PipelineCard extends StatelessWidget {
  const _PipelineCard({
    required this.data,
    required this.maxCount,
    required this.l10n,
  });
  final SalesDashboard data;
  final int maxCount;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final total = kLeadStages.fold<int>(
      0,
      (s, st) => s + (data.pipeline[st] ?? 0),
    );

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.card,
        border: Border.all(color: colors.hairline),
        boxShadow: colors.shadowCard,
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: colors.brandNavy.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.stacked_bar_chart_rounded,
                  size: 18,
                  color: colors.brandNavy,
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                l10n.dashboardPipeline,
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: colors.brandNavy.withValues(alpha: 0.08),
                  border: Border.all(
                    color: colors.brandNavy.withValues(alpha: 0.18),
                  ),
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
                child: Text(
                  '$total',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: colors.brandNavy,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Divider(height: 1, thickness: 1, color: colors.hairline),
          const SizedBox(height: AppSpacing.xs),
          if (total == 0)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
              child: Text(
                l10n.leadsEmptyTitle,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: colors.inkMuted,
                  fontWeight: FontWeight.w500,
                ),
              ),
            )
          else
            for (final stage in kLeadStages)
              if ((data.pipeline[stage] ?? 0) > 0)
                _PipelineRow(
                  stage: stage,
                  count: data.pipeline[stage]!,
                  maxCount: maxCount,
                  l10n: l10n,
                ),
        ],
      ),
    );
  }
}

class _PipelineRow extends StatelessWidget {
  const _PipelineRow({
    required this.stage,
    required this.count,
    required this.maxCount,
    required this.l10n,
  });
  final String stage;
  final int count;
  final int maxCount;
  final AppLocalizations l10n;

  static Color _color(BadgeTone tone, AppColorsExt c) => switch (tone) {
    BadgeTone.gold => c.brandGold,
    BadgeTone.success => c.success,
    BadgeTone.info => c.info,
    BadgeTone.warning => c.warning,
    BadgeTone.error => c.error,
    _ => c.inkMuted,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final toneColor = _color(leadStageTone(stage), colors);
    final progress = count / maxCount;

    // RTL row order: [chip, count, bar]
    // In RTL, index-0 is placed at the START (rightmost), so the stage chip
    // lands on the RIGHT — the first element Arabic eyes encounter — then the
    // count, then the bar filling leftward. Natural right-to-left reading:
    // stage name → number → proportion bar.
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Container(
            width: 72,
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
            decoration: BoxDecoration(
              color: toneColor.withValues(alpha: 0.10),
              border: Border.all(color: toneColor.withValues(alpha: 0.28)),
              borderRadius: BorderRadius.circular(AppRadii.pill),
            ),
            child: Text(
              leadStageLabel(l10n, stage),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: toneColor,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          SizedBox(
            width: 22,
            child: Text(
              '$count',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: colors.inkStrong,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.xs),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: toneColor.withValues(alpha: 0.10),
                valueColor: AlwaysStoppedAnimation<Color>(toneColor),
                minHeight: 8,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── 6. Monthly performance ─────────────────────────────────────────────────────

class _PerformanceDarkModule extends StatelessWidget {
  const _PerformanceDarkModule({required this.l10n, required this.lang});
  final AppLocalizations l10n;
  final String lang;

  static const _bg1 = Color(0xFF1C3352);
  static const _bg2 = Color(0xFF0F1E33);

  static String _period() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<TargetSummaryCubit, TargetSummaryState>(
      builder: (context, targetState) {
        return BlocBuilder<BonusSummaryCubit, BonusSummaryState>(
          builder: (context, bonusState) {
            final isLoading =
                targetState.status == TargetSummaryStatus.loading &&
                bonusState.status == SummaryStatus.loading;
            if (isLoading) return _PerformanceSkeleton();

            final hasTarget =
                targetState.status == TargetSummaryStatus.ready &&
                targetState.performance != null;
            final hasBonus =
                bonusState.status == SummaryStatus.ready &&
                bonusState.overview != null;
            final perf = targetState.performance;
            final bonus = bonusState.overview;

            return Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_bg1, _bg2],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: AppRadii.card,
                border: Border.all(
                  color: AppPalette.gold400.withValues(alpha: 0.14),
                  width: 0.8,
                ),
                boxShadow: [
                  const BoxShadow(
                    color: Color(0x500F1E33),
                    blurRadius: 22,
                    offset: Offset(0, 8),
                  ),
                  BoxShadow(
                    color: AppPalette.gold400.withValues(alpha: 0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Stack(
                children: [
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: AppRadii.card,
                      child: CustomPaint(painter: _DotPatternPainter()),
                    ),
                  ),
                  // Gold shimmer top strip
                  Positioned(
                    top: 0, left: 0, right: 0,
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(14),
                      ),
                      child: Container(
                        height: 2,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.transparent,
                              Color(0xAAC8A24B),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md, AppSpacing.md,
                      AppSpacing.md, AppSpacing.md,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // ── Header ──────────────────────────────────
                        Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFFAA8528), Color(0xFFC8A24B)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(11),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppPalette.gold400.withValues(alpha: 0.45),
                                    blurRadius: 10,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.insights_rounded,
                                color: AppPalette.navy,
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: Text(
                                l10n.dashboardMonthlyPerformance,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.2,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.06),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.18),
                                ),
                                borderRadius: BorderRadius.circular(AppRadii.pill),
                              ),
                              child: Text(
                                _period(),
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.70),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Container(height: 0.5, color: Colors.white.withValues(alpha: 0.10)),
                        const SizedBox(height: 14),

                        // ── Metrics ──────────────────────────────────
                        if (hasTarget) ...[
                          Row(
                            children: [
                              // Sales value tile
                              Expanded(
                                flex: 5,
                                child: _PerfMetricTile(
                                  icon: Icons.payments_rounded,
                                  label: l10n.targetAmount,
                                  value: PriceFormatter.format(
                                    perf!.achievedAmount,
                                    languageCode: lang,
                                  ),
                                  target: perf.targetAmount == null
                                      ? null
                                      : PriceFormatter.format(
                                          perf.targetAmount!,
                                          languageCode: lang,
                                        ),
                                  color: AppPalette.gold400,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              // Units sold tile
                              Expanded(
                                flex: 3,
                                child: _PerfMetricTile(
                                  icon: Icons.home_work_rounded,
                                  label: l10n.targetUnits,
                                  value: '${perf.achievedUnits}',
                                  target: perf.targetUnits == null
                                      ? null
                                      : '${perf.targetUnits}',
                                  color: AppPalette.successLight,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          // Progress bar with label
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    lang == 'ar' ? 'نسبة الإنجاز' : 'Achievement',
                                    style: TextStyle(
                                      color: Colors.white.withValues(alpha: 0.50),
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 0.2,
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    '${(perf.targetAmountPercent ?? 0).toStringAsFixed(0)}%',
                                    style: const TextStyle(
                                      color: AppPalette.gold400,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Stack(
                                children: [
                                  // Track
                                  Container(
                                    height: 6,
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.10),
                                      borderRadius: AppRadii.pillAll,
                                    ),
                                  ),
                                  // Filled portion
                                  FractionallySizedBox(
                                    widthFactor: ((perf.targetAmountPercent ?? 0)
                                            .clamp(0.0, 100.0) /
                                        100),
                                    child: Container(
                                      height: 6,
                                      decoration: BoxDecoration(
                                        gradient: const LinearGradient(
                                          colors: [Color(0xFFAA8528), Color(0xFFC8A24B)],
                                        ),
                                        borderRadius: AppRadii.pillAll,
                                        boxShadow: [
                                          BoxShadow(
                                            color: AppPalette.gold400.withValues(alpha: 0.55),
                                            blurRadius: 6,
                                            offset: const Offset(0, 1),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ] else if (targetState.status != TargetSummaryStatus.loading) ...[
                          Text(
                            l10n.targetsNone,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.50),
                              fontSize: 12,
                            ),
                          ),
                        ],

                        // ── Commission chips ─────────────────────────
                        if (hasBonus) ...[
                          const SizedBox(height: 14),
                          Container(height: 0.5, color: Colors.white.withValues(alpha: 0.10)),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: _CommissionChip(
                                  icon: Icons.check_circle_rounded,
                                  label: l10n.bonusPaid,
                                  amount: PriceFormatter.format(
                                    bonus!.paidTotal,
                                    languageCode: lang,
                                  ),
                                  color: AppPalette.successLight,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: _CommissionChip(
                                  icon: Icons.schedule_rounded,
                                  label: l10n.bonusPending,
                                  amount: PriceFormatter.format(
                                    bonus.pendingTotal,
                                    languageCode: lang,
                                  ),
                                  color: AppPalette.warningLight,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _PerfMetricTile extends StatelessWidget {
  const _PerfMetricTile({
    required this.icon,
    required this.label,
    required this.value,
    this.target,
    required this.color,
  });
  final IconData icon;
  final String label;
  final String value;
  final String? target;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.18), width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: color.withValues(alpha: 0.75)),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.50),
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.1,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: color,
              fontSize: 16,
              fontWeight: FontWeight.w800,
              height: 1.1,
            ),
          ),
          if (target != null) ...[
            const SizedBox(height: 2),
            Row(
              children: [
                Text(
                  'من ',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.30),
                    fontSize: 10,
                  ),
                ),
                Expanded(
                  child: Text(
                    target!,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.40),
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _CommissionChip extends StatelessWidget {
  const _CommissionChip({
    required this.icon,
    required this.label,
    required this.amount,
    required this.color,
  });
  final IconData icon;
  final String label;
  final String amount;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: color.withValues(alpha: 0.22), width: 0.8),
      ),
      child: Row(
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.50),
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  amount,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: color,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    height: 1.1,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PerformanceSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: Container(
        height: 180,
        decoration: BoxDecoration(
          color: const Color(0xFF1C3352),
          borderRadius: AppRadii.card,
        ),
      ),
    );
  }
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton({required this.bottomPad});
  final double bottomPad;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AppSkeletonizer(
      enabled: true,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          bottomPad + 48,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 130,
              decoration: BoxDecoration(
                color: const Color(0xFF1C3352),
                borderRadius: AppRadii.card,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Container(
              height: 72,
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: AppRadii.card,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Container(
              height: 72,
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: AppRadii.card,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Container(
              height: 68,
              decoration: BoxDecoration(
                color: const Color(0xFFC8A24B),
                borderRadius: AppRadii.card,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                for (int i = 0; i < 2; i++) ...[
                  if (i > 0) const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Container(
                      height: 48,
                      decoration: BoxDecoration(
                        color: colors.surface,
                        borderRadius: AppRadii.card,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Container(
              height: 245,
              decoration: BoxDecoration(
                color: const Color(0xFF1C3352),
                borderRadius: AppRadii.card,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Unified dashboard header delegate.
//
// maxExtent  = topPad + full expanded content  (~168 px content)
// minExtent  = topPad + compact mini-header    (~58 px content)
//
// The delegate owns the safe-area zone so there is never a separate
// status-bar strip. The gradient + dot pattern fills the entire height
// at all scroll positions — no seam, no separate dark strip.
// ---------------------------------------------------------------------------
class _DashboardHeaderDelegate extends SliverPersistentHeaderDelegate {
  const _DashboardHeaderDelegate({
    required this.topPad,
    required this.name,
    required this.l10n,
  });

  final double topPad;
  final String? name;
  final AppLocalizations l10n;

  static const double _expandedContent = 120.0;
  static const double _collapsedContent = 64.0;

  static const _navyDeep = Color(0xFF0B1726);
  static const _navyMid = Color(0xFF14273F);
  static const _navyLight = Color(0xFF243F62);

  @override
  double get maxExtent => topPad + _expandedContent;

  @override
  double get minExtent => topPad + _collapsedContent;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final progress = (shrinkOffset / (maxExtent - minExtent)).clamp(0.0, 1.0);
    // Expanded layer fades out in the first half of the collapse.
    final expandedAlpha = (1.0 - progress * 2.0).clamp(0.0, 1.0);
    // Collapsed layer fades in during the second half.
    final collapsedAlpha = ((progress - 0.5) * 2.0).clamp(0.0, 1.0);
    // Bottom corners animate from rounded → square as it collapses.
    final radius = Radius.circular((1.0 - progress) * (AppRadii.xl + 4));

    return SizedBox.expand(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_navyLight, _navyMid, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: radius,
            bottomRight: radius,
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x40000000),
              blurRadius: 24,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.only(
            bottomLeft: radius,
            bottomRight: radius,
          ),
          child: Stack(
        children: [
          // Dot pattern — always visible at full opacity.
          Positioned.fill(
            child: CustomPaint(painter: _DotPatternPainter()),
          ),

          // Radial gold glow (expanded only).
          PositionedDirectional(
            top: 0,
            end: -30,
            child: Opacity(
              opacity: expandedAlpha,
              child: Container(
                width: 200,
                height: 200,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x22C8A24B), Color(0x00C8A24B)],
                  ),
                ),
              ),
            ),
          ),

          // Gold hairline at the bottom edge (expanded only).
          Positioned(
            bottom: 0,
            left: 40,
            right: 40,
            child: Opacity(
              opacity: expandedAlpha,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      AppPalette.gold400.withValues(alpha: 0.50),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),

          // ── Expanded content ──────────────────────────────────────────
          // Bell (left) and title/subtitle/chips (right) sit side-by-side.
          // OverflowBox prevents overflow assertions during the collapse
          // animation; ClipRRect handles visual clipping.
          Opacity(
            opacity: expandedAlpha,
            child: OverflowBox(
              maxHeight: double.infinity,
              alignment: Alignment.topCenter,
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  topPad + AppSpacing.xs,
                  AppSpacing.md,
                  AppSpacing.md,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Title / subtitle / chips — RTL index 0 = right side.
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            l10n.navDashboard,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5,
                              height: 1.15,
                            ),
                          ),
                          if (name != null) ...[
                            const SizedBox(height: 3),
                            Text(
                              l10n.dashboardWelcomeUser(name!),
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.65),
                                fontSize: 14,
                                height: 1.3,
                              ),
                            ),
                          ],
                          const SizedBox(height: 8),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _RoleChip(label: l10n.salesRoleChip),
                              const SizedBox(width: AppSpacing.xs),
                              _DateChip(),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    // Bell — RTL last = left side of screen.
                    const NotificationsBell(),
                  ],
                ),
              ),
            ),
          ),

          // ── Collapsed mini-header ─────────────────────────────────────
          Opacity(
            opacity: collapsedAlpha,
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.md,
                topPad + AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: SizedBox(
                height: 40,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      l10n.navDashboard,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                        height: 1.2,
                      ),
                    ),
                    const Spacer(),
                    const NotificationsBell(),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _DashboardHeaderDelegate old) =>
      old.topPad != topPad || old.name != name;
}
