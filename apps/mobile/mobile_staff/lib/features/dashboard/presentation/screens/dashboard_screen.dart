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
  const DashboardScreen({super.key});

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
                  // Pinned navy backdrop exactly the height of the status bar /
                  // Dynamic Island. It is always visible, so content can never
                  // scroll through the notch area.
                  SliverPersistentHeader(
                    pinned: true,
                    delegate: _NavyStatusBarDelegate(topPad),
                  ),
                  SliverToBoxAdapter(
                    child: _DashboardHeader(
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

// ── Header (scrolls with content) ─────────────────────────────────────────────

class _DashboardHeader extends StatelessWidget {
  const _DashboardHeader({required this.name, required this.l10n});
  final String? name;
  final AppLocalizations l10n;

  static const _navyDeep = Color(0xFF0B1726);
  static const _navyMid = Color(0xFF14273F);
  static const _navyLight = Color(0xFF243F62);

  @override
  Widget build(BuildContext context) {
    return Container(
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_navyLight, _navyMid, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(AppRadii.xl + 4),
            bottomRight: Radius.circular(AppRadii.xl + 4),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x40000000),
              blurRadius: 24,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            Positioned.fill(child: CustomPaint(painter: _DotPatternPainter())),
            PositionedDirectional(
              top: 0,
              end: -30,
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
            Positioned(
              bottom: 0,
              left: 40,
              right: 40,
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
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.md,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.navDashboard,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.3,
                            height: 1.2,
                          ),
                        ),
                        if (name != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            l10n.dashboardWelcomeUser(name!),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.70),
                              fontSize: 14,
                              height: 1.3,
                            ),
                          ),
                        ],
                        const SizedBox(height: 10),
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
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: NotificationsBell(),
                  ),
                ],
              ),
            ),
          ],
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
  const _DashboardBody({required this.data, required this.bottomPad});
  final SalesDashboard data;
  final double bottomPad;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = context.read<SessionCubit>().state.role;
    final canReviewPayments =
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
          _FocusSection(data: data, l10n: l10n, lang: lang),
          const SizedBox(height: AppSpacing.lg),

          // ── 3. Quick actions ──────────────────────────────────────────
          AppSectionHeader(title: l10n.dashboardQuickActions),
          const SizedBox(height: AppSpacing.xs),
          _CompactQuickActions(
            l10n: l10n,
            canReviewPayments: canReviewPayments,
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
  });
  final SalesDashboard data;
  final AppLocalizations l10n;
  final String lang;

  List<_FocusData> _items() {
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
          route: '/visits?today=1',
        ),
      );
    }

    final neg = data.pipeline['NEGOTIATION'] ?? 0;
    if (neg > 0) {
      items.add(
        _FocusData(
          icon: Icons.handshake_outlined,
          label: lang == 'ar'
              ? (neg == 1
                    ? 'عميل واحد في مرحلة التفاوض'
                    : '$neg عملاء في التفاوض')
              : (neg == 1
                    ? '1 client in negotiation'
                    : '$neg clients in negotiation'),
          chipLabel: lang == 'ar' ? 'تفاوض' : 'Negotiation',
          tone: AppTone.warning,
          route: '/leads',
        ),
      );
    }

    final interested = data.pipeline['INTERESTED'] ?? 0;
    if (interested > 0) {
      items.add(
        _FocusData(
          icon: Icons.person_search_outlined,
          label: lang == 'ar'
              ? (interested == 1
                    ? 'عميل مهتم يحتاج متابعة'
                    : '$interested عملاء مهتمون يحتاجون متابعة')
              : (interested == 1
                    ? '1 interested lead needs follow-up'
                    : '$interested leads need follow-up'),
          chipLabel: lang == 'ar' ? 'مهتم' : 'Interested',
          tone: AppTone.navy,
          route: '/leads',
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
          route: null,
        ),
      );
    }

    return items;
  }

  @override
  Widget build(BuildContext context) {
    final items = _items();
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
    this.route,
  });
  final IconData icon;
  final String label;
  final String chipLabel;
  final AppTone tone;
  final String? route;
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
    final hasRoute = widget.item.route != null;
    final isRtl = Directionality.of(context) == TextDirection.rtl;

    return GestureDetector(
      onTapDown: hasRoute ? (_) => setState(() => _pressed = true) : null,
      onTapUp: hasRoute ? (_) => setState(() => _pressed = false) : null,
      onTapCancel: hasRoute ? () => setState(() => _pressed = false) : null,
      onTap: hasRoute ? () => context.push(widget.item.route!) : null,
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
              // Disclosure indicator — on the trailing/end side (LEFT in RTL)
              if (hasRoute) ...[
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
                  child: Transform.flip(
                    flipX: isRtl,
                    child: Icon(
                      Icons.chevron_left_rounded,
                      color: toneColor,
                      size: 18,
                    ),
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

// ── 3. Quick actions — primary banner + 2×2 grid ──────────────────────────────

class _CompactQuickActions extends StatelessWidget {
  const _CompactQuickActions({
    required this.l10n,
    required this.canReviewPayments,
  });
  final AppLocalizations l10n;
  final bool canReviewPayments;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PrimaryBookingCard(l10n: l10n),
        const SizedBox(height: AppSpacing.sm),
        _SecondaryActionsGrid(l10n: l10n, canReviewPayments: canReviewPayments),
      ],
    );
  }
}

class _PrimaryBookingCard extends StatefulWidget {
  const _PrimaryBookingCard({required this.l10n});
  final AppLocalizations l10n;

  @override
  State<_PrimaryBookingCard> createState() => _PrimaryBookingCardState();
}

class _PrimaryBookingCardState extends State<_PrimaryBookingCard> {
  bool _pressed = false;

  static const _gold1 = Color(0xFFAA8528);
  static const _gold2 = Color(0xFFC8A24B);

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final isRtl = Directionality.of(context) == TextDirection.rtl;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => context.push('/reservations/new'),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: const Cubic(0.32, 0.72, 0, 1),
        child: Container(
          height: 62,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [_gold1, _gold2],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            borderRadius: AppRadii.card,
            boxShadow: [
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.38),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              Positioned.fill(
                child: CustomPaint(painter: _DotPatternPainter()),
              ),
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  0,
                  AppSpacing.sm,
                  0,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.18),
                        borderRadius: const BorderRadius.all(
                          Radius.circular(13),
                        ),
                      ),
                      child: const Icon(
                        Icons.bookmark_add_outlined,
                        color: Colors.white,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            widget.l10n.reservationNew,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              height: 1.2,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            lang == 'ar'
                                ? 'ابدأ حجزاً جديداً الآن'
                                : 'Start a new booking now',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.72),
                              fontSize: 12,
                              height: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Disclosure indicator on trailing side (LEFT in RTL)
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: Transform.flip(
                        flipX: isRtl,
                        child: Icon(
                          Icons.chevron_left_rounded,
                          color: Colors.white.withValues(alpha: 0.85),
                          size: 20,
                        ),
                      ),
                    ),
                  ],
                ),
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
  });
  final AppLocalizations l10n;
  final bool canReviewPayments;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: _SecondaryActionCell(
                icon: Icons.event_outlined,
                label: l10n.visitNew,
                onTap: () => context.push('/visits/new'),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: _SecondaryActionCell(
                icon: Icons.calculate_outlined,
                label: l10n.calculatorTitle,
                onTap: () => context.push('/calculator'),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Row(
          children: [
            Expanded(
              child: _SecondaryActionCell(
                icon: Icons.track_changes_outlined,
                label: l10n.targetsTitle,
                onTap: () => context.push('/targets'),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
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
          const SizedBox(height: AppSpacing.xs),
          _SecondaryActionCell(
            icon: Icons.receipt_long_outlined,
            label: l10n.paymentReviewTitle,
            onTap: () => context.push('/payments-review'),
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
        duration: const Duration(milliseconds: 100),
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            color: colors.surface,
            border: Border.all(color: colors.hairline),
            borderRadius: BorderRadius.circular(AppRadii.md),
            boxShadow: colors.shadowCard,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: colors.brandNavy.withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(widget.icon, size: 16, color: colors.brandNavy),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  widget.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: colors.inkStrong,
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

  static const _navyDeep = Color(0xFF0A1520);

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
        child: Container(
          width: widget.width,
          decoration: BoxDecoration(
            color: const Color(0xFF1C3352),
            borderRadius: AppRadii.card,
            boxShadow: const [
              BoxShadow(
                color: Color(0x44000000),
                blurRadius: 14,
                offset: Offset(0, 5),
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
                  errorBuilder: (context, error, stackTrace) =>
                      const _ProjectCardPlaceholder(),
                )
              else
                const _ProjectCardPlaceholder(),
              // Multi-stop gradient overlay for natural image-to-text transition
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      _navyDeep.withValues(alpha: 0.35),
                      _navyDeep.withValues(alpha: 0.78),
                      _navyDeep.withValues(alpha: 0.97),
                    ],
                    stops: const [0.20, 0.50, 0.72, 1.0],
                  ),
                ),
              ),
              // Availability badge — top trailing corner
              PositionedDirectional(
                top: AppSpacing.xs,
                end: AppSpacing.xs,
                child: _AvailabilityBadge(available: available, lang: lang),
              ),
              // Project info — anchored to bottom
              PositionedDirectional(
                start: AppSpacing.md,
                end: AppSpacing.md,
                bottom: AppSpacing.sm,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        height: 1.25,
                        letterSpacing: -0.2,
                      ),
                    ),
                    if (p.city != null) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(
                            Icons.location_on_outlined,
                            size: 12,
                            color: Colors.white.withValues(alpha: 0.60),
                          ),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              p.city!,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.60),
                                fontSize: 12,
                                height: 1.2,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                    if (p.startingPrice != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        (lang == 'ar' ? 'يبدأ من ' : 'From ') +
                            PriceFormatter.format(
                              p.startingPrice!,
                              languageCode: lang,
                            ),
                        style: const TextStyle(
                          color: AppPalette.gold300,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    // Gold CTA button
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFAA8528), Color(0xFFC8A24B)],
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                        ),
                        borderRadius: BorderRadius.circular(AppRadii.sm + 2),
                        boxShadow: [
                          BoxShadow(
                            color: AppPalette.gold400.withValues(alpha: 0.30),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Text(
                        lang == 'ar' ? 'عرض المشروع' : 'View Project',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppPalette.navy,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ],
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
    final labelColor = hasAvailable ? AppPalette.successLight : Colors.white;
    final label = hasAvailable
        ? (lang == 'ar' ? '$available متاح' : '$available avail.')
        : (lang == 'ar' ? 'مباع' : 'Sold out');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.45),
        border: Border.all(color: labelColor.withValues(alpha: 0.50)),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: labelColor,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
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
          for (final stage in kLeadStages)
            _PipelineRow(
              stage: stage,
              count: data.pipeline[stage] ?? 0,
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
                  Padding(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // ── Header ──────────────────────────────────
                        Row(
                          children: [
                            Container(
                              width: 30,
                              height: 30,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [AppPalette.gold300, AppPalette.gold500],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: const BorderRadius.all(Radius.circular(9)),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppPalette.gold400.withValues(alpha: 0.40),
                                    blurRadius: 8,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.insights_rounded,
                                color: AppPalette.navy,
                                size: 15,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Text(
                              l10n.dashboardMonthlyPerformance,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.20),
                                ),
                                borderRadius: BorderRadius.circular(AppRadii.pill),
                              ),
                              child: Text(
                                _period(),
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.60),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Container(height: 0.5, color: Colors.white.withValues(alpha: 0.12)),
                        const SizedBox(height: 8),

                        // ── Metrics ──────────────────────────────────
                        if (hasTarget) ...[
                          IntrinsicHeight(
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                // Sales amount column
                                Expanded(
                                  flex: 5,
                                  child: _PerfMetricCell(
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
                                _PerfVertDivider(),
                                // Units column
                                Expanded(
                                  flex: 3,
                                  child: _PerfMetricCell(
                                    label: l10n.targetUnits,
                                    value: '${perf.achievedUnits}',
                                    target: perf.targetUnits == null
                                        ? null
                                        : '${perf.targetUnits}',
                                    color: AppPalette.successLight,
                                    alignEnd: true,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                          // Thin progress bar + percentage
                          Row(
                            children: [
                              Expanded(
                                child: ClipRRect(
                                  borderRadius: AppRadii.pillAll,
                                  child: LinearProgressIndicator(
                                    value: (perf.targetAmountPercent ?? 0)
                                            .clamp(0.0, 100.0) /
                                        100,
                                    minHeight: 5,
                                    backgroundColor:
                                        Colors.white.withValues(alpha: 0.12),
                                    valueColor:
                                        const AlwaysStoppedAnimation<Color>(
                                      AppPalette.gold400,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.xs),
                              SizedBox(
                                width: 34,
                                child: Text(
                                  '${(perf.targetAmountPercent ?? 0).toStringAsFixed(0)}%',
                                  textAlign: TextAlign.end,
                                  style: TextStyle(
                                    color: AppPalette.gold400.withValues(alpha: 0.90),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
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

                        // ── Commission ───────────────────────────────
                        if (hasBonus) ...[
                          const SizedBox(height: 8),
                          Container(height: 0.5, color: Colors.white.withValues(alpha: 0.12)),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Icon(
                                Icons.check_circle_rounded,
                                size: 12,
                                color: AppPalette.successLight,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                l10n.bonusPaid,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.55),
                                  fontSize: 11,
                                ),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                PriceFormatter.format(
                                  bonus!.paidTotal,
                                  languageCode: lang,
                                ),
                                style: const TextStyle(
                                  color: AppPalette.successLight,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const Spacer(),
                              Icon(
                                Icons.schedule_rounded,
                                size: 12,
                                color: AppPalette.warningLight,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                l10n.bonusPending,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.55),
                                  fontSize: 11,
                                ),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                PriceFormatter.format(
                                  bonus.pendingTotal,
                                  languageCode: lang,
                                ),
                                style: const TextStyle(
                                  color: AppPalette.warningLight,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
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

class _PerfMetricCell extends StatelessWidget {
  const _PerfMetricCell({
    required this.label,
    required this.value,
    this.target,
    required this.color,
    this.alignEnd = false,
  });
  final String label;
  final String value;
  final String? target;
  final Color color;
  final bool alignEnd;

  @override
  Widget build(BuildContext context) {
    final cross = alignEnd ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    return Padding(
      padding: alignEnd
          ? const EdgeInsetsDirectional.only(start: AppSpacing.xs)
          : EdgeInsetsDirectional.zero,
      child: Column(
        crossAxisAlignment: cross,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.55),
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 3),
          Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value,
                style: TextStyle(
                  color: color,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                ),
              ),
              if (target != null) ...[
                Text(
                  '  /  ',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.25),
                    fontSize: 11,
                  ),
                ),
                Text(
                  target!,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.45),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _PerfVertDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        width: 0.5,
        margin: const EdgeInsets.symmetric(horizontal: 10),
        color: Colors.white.withValues(alpha: 0.14),
      );
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
// Pinned navy backdrop that permanently covers the status bar / Dynamic Island
// so no scrolling content ever bleeds through the notch.
// ---------------------------------------------------------------------------
class _NavyStatusBarDelegate extends SliverPersistentHeaderDelegate {
  const _NavyStatusBarDelegate(this._extent);
  final double _extent;

  static const _color = Color(0xFF0B1726);

  @override
  double get minExtent => _extent;

  @override
  double get maxExtent => _extent;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) =>
      // SizedBox.expand fills the sliver's allocated extent regardless of whether
      // the framework passes tight or loose BoxConstraints to the child.
      SizedBox.expand(child: const ColoredBox(color: _color));

  @override
  bool shouldRebuild(covariant _NavyStatusBarDelegate old) =>
      old._extent != _extent;
}
