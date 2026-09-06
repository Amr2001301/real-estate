import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/broker_status_label.dart';
import '../../../../../common/reservation_status_label.dart';
import '../../../../notifications/presentation/widgets/notifications_bell.dart';
import '../../../catalog/domain/entities/broker_project.dart';
import '../../../catalog/presentation/cubit/broker_projects_cubit.dart';
import '../../../profile/presentation/cubit/broker_profile_cubit.dart';
import '../../domain/entities/broker_dashboard.dart';
import '../cubit/broker_dashboard_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Broker Dashboard Screen
// ─────────────────────────────────────────────────────────────────────────────

class BrokerDashboardScreen extends StatefulWidget {
  const BrokerDashboardScreen({super.key, this.onSwitchTab});
  final void Function(int)? onSwitchTab;

  @override
  State<BrokerDashboardScreen> createState() => _BrokerDashboardScreenState();
}

class _BrokerDashboardScreenState extends State<BrokerDashboardScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerDashboardCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final brokerName = context.select<BrokerProfileCubit, String?>(
      (c) => c.state.data?.fullName,
    );
    final mq = MediaQuery.of(context);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<BrokerDashboardCubit, BrokerDashboardState>(
          builder: (context, state) {
            return RefreshIndicator(
              onRefresh: () => context.read<BrokerDashboardCubit>().load(),
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverPersistentHeader(
                    pinned: true,
                    delegate: _BrokerHeaderDelegate(
                      topPad: mq.padding.top,
                      name: brokerName,
                      l10n: l10n,
                    ),
                  ),
                  if (state.status == DataStatus.initial ||
                      state.status == DataStatus.loading)
                    SliverToBoxAdapter(
                      child: _Skeleton(bottomPad: mq.padding.bottom),
                    )
                  else if (state.status == DataStatus.failure)
                    SliverFillRemaining(
                      child: ErrorState(
                        failure: state.failure,
                        onRetry: () =>
                            context.read<BrokerDashboardCubit>().load(),
                      ),
                    )
                  else
                    SliverToBoxAdapter(
                      child: _Body(
                        data: state.data!,
                        bottomPad: mq.padding.bottom,
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

// ── Collapsing header ─────────────────────────────────────────────────────────

class _BrokerHeaderDelegate extends SliverPersistentHeaderDelegate {
  const _BrokerHeaderDelegate({
    required this.topPad,
    this.name,
    required this.l10n,
  });

  final double topPad;
  final String? name;
  final AppLocalizations l10n;

  static const double _expandedContent = 120.0;
  static const double _collapsedContent = 64.0;

  @override
  double get maxExtent => topPad + _expandedContent;

  @override
  double get minExtent => topPad + _collapsedContent;

  @override
  bool shouldRebuild(covariant _BrokerHeaderDelegate old) =>
      old.topPad != topPad || old.name != name;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    final progress =
        (shrinkOffset / (maxExtent - minExtent)).clamp(0.0, 1.0);
    final expandedAlpha = (1.0 - progress * 2.0).clamp(0.0, 1.0);
    final collapsedAlpha = ((progress - 0.5) * 2.0).clamp(0.0, 1.0);
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
          borderRadius:
              BorderRadius.only(bottomLeft: radius, bottomRight: radius),
          boxShadow: const [
            BoxShadow(
                color: Color(0x40000000),
                blurRadius: 24,
                offset: Offset(0, 8)),
          ],
        ),
        child: ClipRRect(
          borderRadius:
              BorderRadius.only(bottomLeft: radius, bottomRight: radius),
          child: Stack(
            children: [
              Positioned.fill(child: CustomPaint(painter: _DotPainter())),
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

              // Expanded content
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
                                    color:
                                        Colors.white.withValues(alpha: 0.65),
                                    fontSize: 14,
                                    height: 1.3,
                                  ),
                                ),
                              ],
                              const SizedBox(height: 8),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const _RoleChip(),
                                  const SizedBox(width: AppSpacing.xs),
                                  const _DateChip(),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        const NotificationsBell(),
                      ],
                    ),
                  ),
                ),
              ),

              // Collapsed mini-header
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
}

class _RoleChip extends StatelessWidget {
  const _RoleChip();

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
      child: const Text(
        'وسيط عقاري',
        style: TextStyle(
          color: _navyDeep,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _DateChip extends StatelessWidget {
  const _DateChip();

  static const _ar = [
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
  static const _en = [
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

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final lang = Localizations.localeOf(context).languageCode;
    final label = lang == 'ar'
        ? '${now.day} ${_ar[now.month]}'
        : '${_en[now.month]} ${now.day}';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.80),
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

// ── Dashboard body ─────────────────────────────────────────────────────────────

class _Body extends StatelessWidget {
  const _Body({required this.data, required this.bottomPad, this.onSwitchTab});
  final BrokerDashboard data;
  final double bottomPad;
  final void Function(int)? onSwitchTab;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final canViewCommissions = context.select<BrokerProfileCubit, bool>(
      (c) => c.state.data?.canViewCommissions ?? false,
    );

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
          // ── 1. KPI snapshot ───────────────────────────────────────────────
          _SnapshotCard(data: data, l10n: l10n, onSwitchTab: onSwitchTab),
          const SizedBox(height: AppSpacing.lg),

          // ── 2. Today's priorities ─────────────────────────────────────────
          AppSectionHeader(title: 'أولويات اليوم'),
          const SizedBox(height: AppSpacing.xs),
          _PrioritySection(data: data, onSwitchTab: onSwitchTab),
          const SizedBox(height: AppSpacing.lg),

          // ── 3. Quick actions ──────────────────────────────────────────────
          AppSectionHeader(title: l10n.dashboardQuickActions),
          const SizedBox(height: AppSpacing.xs),
          _QuickActionsSection(
            l10n: l10n,
            canViewCommissions: canViewCommissions,
            onSwitchTab: onSwitchTab,
          ),
          const SizedBox(height: AppSpacing.lg),

          // ── 4. Available projects ─────────────────────────────────────────
          AppSectionHeader(
            title: 'المشاريع المتاحة',
            action: TextButton(
              onPressed: () => onSwitchTab?.call(1),
              child: Text(
                'عرض الكل',
                style: TextStyle(
                  color: AppPalette.gold500,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          const _ProjectsSection(),
          const SizedBox(height: AppSpacing.lg),

          // ── 5. Commission card ────────────────────────────────────────────
          if (canViewCommissions) ...[
            _CommissionCard(
                amount: data.commissionsGross, l10n: l10n, lang: lang),
            if (data.salesGross > 0) ...[
              const SizedBox(height: AppSpacing.sm),
              _SalesVolumeCard(amount: data.salesGross, l10n: l10n, lang: lang),
            ],
            const SizedBox(height: AppSpacing.lg),
          ],

          // ── 6. Recent leads ───────────────────────────────────────────────
          if (data.recentLeads.isNotEmpty) ...[
            AppSectionHeader(
              title: l10n.brokerRecentLeads,
              action: TextButton(
                onPressed: () => onSwitchTab?.call(2),
                child: Text(
                  'عرض الكل',
                  style: TextStyle(
                    color: AppPalette.gold500,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            for (final lead in data.recentLeads.take(5))
              _RecentLeadTile(lead: lead),
            const SizedBox(height: AppSpacing.lg),
          ],

          // ── 7. Recent reservations ────────────────────────────────────────
          if (data.recentReservations.isNotEmpty) ...[
            AppSectionHeader(
              title: l10n.brokerRecentReservations,
              action: TextButton(
                onPressed: () => onSwitchTab?.call(3),
                child: Text(
                  'عرض الكل',
                  style: TextStyle(
                    color: AppPalette.gold500,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            for (final r in data.recentReservations.take(5))
              _RecentReservationTile(reservation: r),
          ],
        ],
      ),
    );
  }
}

// ── 1. Snapshot card ──────────────────────────────────────────────────────────

class _SnapshotCard extends StatelessWidget {
  const _SnapshotCard(
      {required this.data, required this.l10n, this.onSwitchTab});
  final BrokerDashboard data;
  final AppLocalizations l10n;
  final void Function(int)? onSwitchTab;

  static const _bg1 = Color(0xFF1C3352);
  static const _bg2 = Color(0xFF0F1E33);

  @override
  Widget build(BuildContext context) {
    final approvalRate = data.leadsTotal > 0
        ? ((data.leadsApproved / data.leadsTotal) * 100).round()
        : 0;

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
              color: Color(0x500F1E33), blurRadius: 22, offset: Offset(0, 8)),
        ],
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: AppRadii.card,
              child: CustomPaint(painter: _DotPainter()),
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
                // Header row
                Row(
                  children: [
                    Text(
                      'لقطة الإنجاز',
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
                          horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: AppPalette.gold400.withValues(alpha: 0.45),
                        ),
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.circle,
                              size: 6, color: AppPalette.gold300),
                          const SizedBox(width: 4),
                          const Text(
                            'نشاط',
                            style: TextStyle(
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
                    color: Colors.white.withValues(alpha: 0.10)),
                const SizedBox(height: AppSpacing.sm),
                // Row 1: leads + approval rate
                IntrinsicHeight(
                  child: Row(
                    children: [
                      _DarkMetric(
                        value: '${data.leadsTotal}',
                        label: 'الفرص المُرسلة',
                        onTap: onSwitchTab != null
                            ? () => onSwitchTab!(2)
                            : null,
                      ),
                      _DarkDivider(),
                      _DarkMetric(
                        value: '$approvalRate%',
                        label: 'نسبة القبول',
                        isGold: true,
                      ),
                      _DarkDivider(),
                      _DarkMetric(
                        value: '${data.reservationsTotal}',
                        label: l10n.navReservations,
                        onTap: onSwitchTab != null
                            ? () => onSwitchTab!(3)
                            : null,
                      ),
                      _DarkDivider(),
                      _DarkMetric(
                        value: '${data.contractsSigned}',
                        label: 'عقود موقعة',
                        isGold: data.contractsSigned > 0,
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
                fontSize: 26,
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
                fontSize: 10,
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

// ── 2. Priority section ───────────────────────────────────────────────────────

class _PrioritySection extends StatelessWidget {
  const _PrioritySection({required this.data, this.onSwitchTab});
  final BrokerDashboard data;
  final void Function(int)? onSwitchTab;

  @override
  Widget build(BuildContext context) {
    final items = <_PriorityItem>[];

    final pendingLeads = data.leadsTotal - data.leadsApproved;
    if (pendingLeads > 0) {
      items.add(_PriorityItem(
        icon: Icons.person_search_outlined,
        label: pendingLeads == 1
            ? 'عميل محتمل واحد ينتظر الموافقة'
            : '$pendingLeads عملاء ينتظرون الموافقة',
        chipLabel: 'في الانتظار',
        color: AppPalette.gold400,
        onTap: onSwitchTab != null ? () => onSwitchTab!(2) : null,
      ));
    }

    final pendingReservations =
        data.reservationsTotal - data.reservationsApproved;
    if (pendingReservations > 0) {
      items.add(_PriorityItem(
        icon: Icons.bookmark_border_rounded,
        label: pendingReservations == 1
            ? 'حجز واحد ينتظر المراجعة'
            : '$pendingReservations حجوزات تنتظر المراجعة',
        chipLabel: 'مراجعة',
        color: const Color(0xFF60A5FA),
        onTap: onSwitchTab != null ? () => onSwitchTab!(3) : null,
      ));
    }

    if (items.isEmpty) {
      items.add(const _PriorityItem(
        icon: Icons.check_circle_outline,
        label: 'لا توجد أولويات عاجلة — أداء ممتاز!',
        chipLabel: 'جيد',
        color: Color(0xFF4ADE80),
      ));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (int i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.xs),
          _PriorityCard(item: items[i]),
        ],
      ],
    );
  }
}

class _PriorityItem {
  const _PriorityItem({
    required this.icon,
    required this.label,
    required this.chipLabel,
    required this.color,
    this.onTap,
  });
  final IconData icon;
  final String label;
  final String chipLabel;
  final Color color;
  final VoidCallback? onTap;
}

class _PriorityCard extends StatefulWidget {
  const _PriorityCard({required this.item});
  final _PriorityItem item;

  @override
  State<_PriorityCard> createState() => _PriorityCardState();
}

class _PriorityCardState extends State<_PriorityCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final c = widget.item.color;
    final hasAction = widget.item.onTap != null;

    return GestureDetector(
      onTapDown: hasAction ? (_) => setState(() => _pressed = true) : null,
      onTapUp: hasAction ? (_) => setState(() => _pressed = false) : null,
      onTapCancel: hasAction ? () => setState(() => _pressed = false) : null,
      onTap: hasAction ? widget.item.onTap : null,
      child: AnimatedScale(
        scale: _pressed ? 0.98 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.md, 14, AppSpacing.md, 14),
          decoration: BoxDecoration(
            color: c.withValues(alpha: 0.055),
            border: Border.all(color: c.withValues(alpha: 0.22)),
            borderRadius: AppRadii.card,
            boxShadow: [
              BoxShadow(
                  color: c.withValues(alpha: 0.06),
                  blurRadius: 8,
                  offset: const Offset(0, 2)),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: c.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(widget.item.icon, color: c, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  widget.item.label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: c.withValues(alpha: 0.9),
                    height: 1.3,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: c.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
                child: Text(
                  widget.item.chipLabel,
                  style: TextStyle(
                      color: c, fontSize: 10, fontWeight: FontWeight.w700),
                ),
              ),
              if (hasAction) ...[
                const SizedBox(width: 4),
                Icon(Icons.arrow_back_ios_new_rounded,
                    color: c.withValues(alpha: 0.5), size: 11),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── 3. Quick actions ──────────────────────────────────────────────────────────

class _QuickActionsSection extends StatelessWidget {
  const _QuickActionsSection({
    required this.l10n,
    required this.canViewCommissions,
    this.onSwitchTab,
  });
  final AppLocalizations l10n;
  final bool canViewCommissions;
  final void Function(int)? onSwitchTab;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PrimaryActionCell(
          icon: Icons.person_add_alt_1_outlined,
          label: l10n.brokerLeadNew,
          onTap: () => context.push('/broker/leads/new'),
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: _SecondaryActionCell(
                icon: Icons.bookmark_add_outlined,
                label: l10n.reservationNew,
                onTap: () => context.push('/broker/reservations/new'),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _SecondaryActionCell(
                icon: Icons.apartment_outlined,
                label: l10n.navProjects,
                onTap: () => onSwitchTab?.call(1),
              ),
            ),
          ],
        ),
        if (canViewCommissions) ...[
          const SizedBox(height: AppSpacing.sm),
          _SecondaryActionCell(
            icon: Icons.payments_outlined,
            label: l10n.navCommissions,
            onTap: () => context.push('/broker/commissions'),
          ),
        ],
      ],
    );
  }
}

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

class _SecondaryActionCell extends StatefulWidget {
  const _SecondaryActionCell({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback? onTap;

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
                blurRadius: 6,
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
                    colors: [Color(0xFFAA8528), Color(0xFFC8A24B)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(widget.icon, color: Colors.white, size: 19),
              ),
              const SizedBox(height: 8),
              Text(
                widget.label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: colors.inkStrong,
                  height: 1.25,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── 4. Available projects ─────────────────────────────────────────────────────

class _ProjectsSection extends StatelessWidget {
  const _ProjectsSection();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<BrokerProjectsCubit, BrokerProjectsState>(
      builder: (context, state) {
        if (state.status == DataStatus.initial ||
            state.status == DataStatus.loading) {
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

        if (state.status == DataStatus.empty ||
            state.data == null ||
            state.data!.isEmpty) {
          return Container(
            height: 100,
            decoration: BoxDecoration(
              color: context.appColors.surface,
              borderRadius: AppRadii.card,
              border: Border.all(
                  color: context.appColors.hairline.withValues(alpha: 0.4)),
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.apartment_outlined,
                      color: context.appColors.inkMuted, size: 28),
                  const SizedBox(height: 8),
                  Text(
                    'لا توجد مشاريع متاحة',
                    style: TextStyle(
                      color: context.appColors.inkMuted,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        // Dynamic card width: one card fully visible + ~40px peek of the next.
        final availableWidth =
            MediaQuery.of(context).size.width - AppSpacing.md * 2;
        final cardWidth = (availableWidth - 52.0).clamp(220.0, double.infinity);
        final lang = Localizations.localeOf(context).languageCode;

        return SizedBox(
          height: 245,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
            itemCount: state.data!.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
            itemBuilder: (_, i) => _ProjectCard(
              project: state.data![i],
              lang: lang,
              width: cardWidth,
            ),
          ),
        );
      },
    );
  }
}

class _ProjectCard extends StatefulWidget {
  const _ProjectCard({
    required this.project,
    required this.lang,
    required this.width,
  });
  final BrokerProject project;
  final String lang;
  final double width;

  @override
  State<_ProjectCard> createState() => _ProjectCardState();
}

class _ProjectCardState extends State<_ProjectCard> {
  bool _pressed = false;

  static const _gold1 = Color(0xFFAA8528);
  static const _gold2 = Color(0xFFC8A24B);

  @override
  Widget build(BuildContext context) {
    final p = widget.project;
    final lang = widget.lang;
    final name = p.name.resolve(lang);
    final hasImage = p.coverImageUrl != null && p.coverImageUrl!.isNotEmpty;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => context.push('/broker/projects/${p.id}', extra: p),
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
              // Background image / placeholder
              if (hasImage)
                Image.network(
                  p.coverImageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => const _ProjectCardPlaceholder(),
                )
              else
                const _ProjectCardPlaceholder(),

              // Deep gradient overlay — clear top, opaque bottom
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

              // Commission badge — top start
              if (p.commissionPct != null)
                PositionedDirectional(
                  top: AppSpacing.sm,
                  start: AppSpacing.sm,
                  child: _CommissionBadge(pct: p.commissionPct!, lang: lang),
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
                            Shadow(
                                color: Color(0x88000000), blurRadius: 6),
                          ],
                        ),
                      ),
                      const SizedBox(height: 5),
                      if (p.city != null)
                        Row(
                          children: [
                            Icon(Icons.location_on_rounded,
                                size: 11,
                                color:
                                    Colors.white.withValues(alpha: 0.55)),
                            const SizedBox(width: 2),
                            Text(
                              p.city!,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.55),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      const SizedBox(height: 10),
                      // Gold CTA pill
                      Container(
                        height: 36,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [_gold1, _gold2],
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                          ),
                          borderRadius:
                              BorderRadius.circular(AppRadii.md),
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
                              lang == 'ar'
                                  ? 'استعراض المشروع'
                                  : 'View Project',
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

class _CommissionBadge extends StatelessWidget {
  const _CommissionBadge({required this.pct, required this.lang});
  final String pct;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final label = lang == 'ar' ? 'عمولة $pct%' : '$pct% comm.';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.50),
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.55),
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
              color: AppPalette.gold300,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppPalette.gold300.withValues(alpha: 0.60),
                  blurRadius: 4,
                ),
              ],
            ),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: AppPalette.gold300,
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
        child: Icon(Icons.apartment_rounded,
            color: Color(0x44FFFFFF), size: 48),
      ),
    );
  }
}

// ── 5. Commission card ────────────────────────────────────────────────────────

class _CommissionCard extends StatelessWidget {
  const _CommissionCard({
    required this.amount,
    required this.l10n,
    required this.lang,
  });
  final double amount;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/broker/commissions'),
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF7C5200), Color(0xFF3D2800)],
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
          ),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF7C5200).withValues(alpha: 0.4),
              blurRadius: 18,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(13),
                border: Border.all(
                    color: AppPalette.gold300.withValues(alpha: 0.3)),
              ),
              child: const Icon(Icons.payments_rounded,
                  color: AppPalette.gold300, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.navCommissions,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(
                    amount > 0 ? 'إجمالي العمولات المستحقة' : 'لا توجد عمولات بعد',
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.55),
                        fontSize: 11,
                        fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ),
            if (amount > 0) ...[
              Text(
                PriceFormatter.format(amount, languageCode: lang),
                style: const TextStyle(
                    color: AppPalette.gold300,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.2),
              ),
              const SizedBox(width: 8),
            ],
            Icon(Icons.arrow_back_ios_new_rounded,
                color: Colors.white.withValues(alpha: 0.5), size: 13),
          ],
        ),
      ),
    );
  }
}

// Sales volume card (حجم المبيعات)
class _SalesVolumeCard extends StatelessWidget {
  const _SalesVolumeCard({
    required this.amount,
    required this.l10n,
    required this.lang,
  });
  final double amount;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1C3352), Color(0xFF0F1E33)],
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
        ),
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
            color: AppPalette.gold400.withValues(alpha: 0.2)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F1E33).withValues(alpha: 0.4),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(13),
              border: Border.all(
                  color: AppPalette.gold400.withValues(alpha: 0.25)),
            ),
            child: const Icon(Icons.trending_up_rounded,
                color: AppPalette.gold300, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('حجم المبيعات',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text('إجمالي قيمة العقود الموقعة',
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.55),
                        fontSize: 11,
                        fontWeight: FontWeight.w500)),
              ],
            ),
          ),
          Text(
            PriceFormatter.format(amount, languageCode: lang),
            style: const TextStyle(
                color: AppPalette.gold300,
                fontSize: 15,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.2),
          ),
        ],
      ),
    );
  }
}

// ── 6. Recent lead tile ───────────────────────────────────────────────────────

class _RecentLeadTile extends StatelessWidget {
  const _RecentLeadTile({required this.lead});
  final BrokerRecentLead lead;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final dateLabel = _relativeDate(lead.createdAt);

    return GestureDetector(
      onTap: () => context.push('/broker/leads/${lead.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadii.card,
          border:
              Border.all(color: colors.hairline.withValues(alpha: 0.4)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_navyLight, _navyDeep],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  lead.fullName.isNotEmpty
                      ? lead.fullName[0].toUpperCase()
                      : '؟',
                  style: const TextStyle(
                    color: AppPalette.gold300,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Name + project
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lead.fullName,
                    style: theme.textTheme.titleSmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (lead.projectName != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      lead.projectName!,
                      style: TextStyle(
                        fontSize: 11,
                        color: colors.inkMuted,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Status + date
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                StatusBadge(
                  label: brokerLeadStatusLabel(l10n, lead.approvalStatus),
                  tone: brokerLeadStatusTone(lead.approvalStatus),
                ),
                if (dateLabel != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    dateLabel,
                    style: TextStyle(
                      fontSize: 10,
                      color: colors.inkMuted,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

}

// ── 7. Recent reservation tile ────────────────────────────────────────────────

class _RecentReservationTile extends StatelessWidget {
  const _RecentReservationTile({required this.reservation});
  final BrokerRecentReservation reservation;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final primary = reservation.reservationNumber ?? reservation.unitCode ?? l10n.navReservations;
    final subtitle = (reservation.reservationNumber != null && reservation.unitCode != null)
        ? reservation.unitCode
        : null;
    final dateLabel = _relativeDate(reservation.createdAt);

    return GestureDetector(
      onTap: () => context.push('/broker/reservations/${reservation.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadii.card,
          border: Border.all(color: colors.hairline.withValues(alpha: 0.4)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            // Icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF7C5200), Color(0xFF3D2800)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.bookmark_rounded,
                  color: AppPalette.gold300, size: 18),
            ),
            const SizedBox(width: 12),
            // Primary + subtitle
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    primary,
                    style: theme.textTheme.titleSmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 11,
                        color: colors.inkMuted,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Status + date
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                StatusBadge(
                  label: reservationStatusLabel(l10n, reservation.status),
                  tone: reservationStatusTone(reservation.status),
                ),
                if (dateLabel != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    dateLabel,
                    style: TextStyle(
                      fontSize: 10,
                      color: colors.inkMuted,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

class _Skeleton extends StatelessWidget {
  const _Skeleton({required this.bottomPad});
  final double bottomPad;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AppSkeletonizer(
      enabled: true,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            AppSpacing.md, AppSpacing.sm, AppSpacing.md, bottomPad + 48),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              height: 120,
              decoration: BoxDecoration(
                  color: _navyMid, borderRadius: AppRadii.card),
            ),
            const SizedBox(height: AppSpacing.lg),
            Container(height: 20, width: 100, color: colors.surface),
            const SizedBox(height: AppSpacing.xs),
            Container(
              height: 68,
              decoration: BoxDecoration(
                  color: colors.surface, borderRadius: AppRadii.card),
            ),
            const SizedBox(height: AppSpacing.lg),
            Container(height: 20, width: 120, color: colors.surface),
            const SizedBox(height: AppSpacing.xs),
            Container(
              height: 52,
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(children: [
              Expanded(
                child: Container(
                  height: 96,
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Container(
                  height: 96,
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                  ),
                ),
              ),
            ]),
            const SizedBox(height: AppSpacing.lg),
            Container(height: 20, width: 130, color: colors.surface),
            const SizedBox(height: AppSpacing.xs),
            SizedBox(
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
            ),
          ],
        ),
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

String? _relativeDate(String? iso) {
  if (iso == null) return null;
  try {
    final d = DateTime.parse(iso).toLocal();
    final now = DateTime.now();
    final diff = now.difference(d);
    if (diff.inDays == 0) return 'اليوم';
    if (diff.inDays == 1) return 'أمس';
    if (diff.inDays < 7) return 'منذ ${diff.inDays} أيام';
    return '${d.year}/${d.month.toString().padLeft(2, '0')}/${d.day.toString().padLeft(2, '0')}';
  } catch (_) {
    return null;
  }
}

class _DotPainter extends CustomPainter {
  const _DotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
