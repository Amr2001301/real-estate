import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/broker_status_label.dart';
import '../../../../../common/reservation_status_label.dart';
import '../../../../notifications/presentation/widgets/notifications_bell.dart';
import '../../../profile/presentation/cubit/broker_profile_cubit.dart';
import '../../domain/entities/broker_dashboard.dart';
import '../cubit/broker_dashboard_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Broker Dashboard Screen
// ─────────────────────────────────────────────────────────────────────────────

class BrokerDashboardScreen extends StatefulWidget {
  const BrokerDashboardScreen({super.key});

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
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: Column(
          children: [
            const _DashHeader(),
            Expanded(
              child: BlocBuilder<BrokerDashboardCubit, BrokerDashboardState>(
                builder: (context, state) {
                  switch (state.status) {
                    case DataStatus.initial:
                    case DataStatus.loading:
                      return const _Skeleton();
                    case DataStatus.failure:
                      return ErrorState(
                        failure: state.failure,
                        onRetry: () =>
                            context.read<BrokerDashboardCubit>().load(),
                      );
                    case DataStatus.empty:
                    case DataStatus.success:
                      return RefreshIndicator(
                        onRefresh: () =>
                            context.read<BrokerDashboardCubit>().load(),
                        child: _Body(data: state.data!),
                      );
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Dashboard header ──────────────────────────────────────────────────────────

class _DashHeader extends StatelessWidget {
  const _DashHeader();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [_navyLight, _navyCard, _navyDeep],
          stops: [0.0, 0.45, 1.0],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x35000000),
            blurRadius: 22,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          const Positioned.fill(
            child: IgnorePointer(child: _DotTexture()),
          ),
          PositionedDirectional(
            end: 0,
            top: 0,
            child: Container(
              width: 180,
              height: 140,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.10),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 0,
            left: 48,
            right: 48,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.0),
                    AppPalette.gold400.withValues(alpha: 0.5),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              topInset + AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.xl,
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
                        style: theme.textTheme.headlineSmall?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'مرحباً بك في لوحة التحكم',
                        style: TextStyle(
                          color: AppPalette.gold300,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.2),
                    ),
                  ),
                  child: IconTheme(
                    data: const IconThemeData(color: Colors.white),
                    child: const NotificationsBell(),
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

// ── Body ──────────────────────────────────────────────────────────────────────

class _Body extends StatelessWidget {
  const _Body({required this.data});
  final BrokerDashboard data;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final canViewCommissions = context.select<BrokerProfileCubit, bool>(
      (c) => c.state.data?.canViewCommissions ?? false,
    );

    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.xl + MediaQuery.of(context).padding.bottom,
      ),
      children: [
        // ── KPI grid ─────────────────────────────────────────────────────────
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: AppSpacing.md,
          crossAxisSpacing: AppSpacing.md,
          childAspectRatio: 1.3,
          children: [
            _KpiTile(
              icon: Icons.people_alt_rounded,
              label: l10n.brokerDashLeads,
              value: '${data.leadsTotal}',
              gradient: const [Color(0xFF243F62), Color(0xFF0B1726)],
              iconColor: AppPalette.gold300,
              onTap: () => context.push('/broker/leads'),
            ),
            _KpiTile(
              icon: Icons.verified_rounded,
              label: l10n.brokerDashApprovedLeads,
              value: '${data.leadsApproved}',
              gradient: const [Color(0xFF0D5C3A), Color(0xFF052B1E)],
              iconColor: Color(0xFF4ADE80),
            ),
            _KpiTile(
              icon: Icons.bookmark_added_rounded,
              label: l10n.navReservations,
              value: '${data.reservationsTotal}',
              gradient: const [Color(0xFF7C5200), Color(0xFF3D2800)],
              iconColor: AppPalette.gold300,
              onTap: () => context.push('/broker/reservations'),
            ),
            _KpiTile(
              icon: Icons.check_circle_rounded,
              label: l10n.brokerDashApprovedReservations,
              value: '${data.reservationsApproved}',
              gradient: const [Color(0xFF0E3A6E), Color(0xFF071B35)],
              iconColor: Color(0xFF60A5FA),
            ),
          ],
        ),

        // ── Commission card ───────────────────────────────────────────────────
        if (canViewCommissions) ...[
          const SizedBox(height: AppSpacing.md),
          _CommissionCard(
            amount: data.commissionsGross,
            l10n: l10n,
            lang: lang,
          ),
        ],

        const SizedBox(height: AppSpacing.lg),

        // ── Quick actions ─────────────────────────────────────────────────────
        _SectionLabel(label: l10n.dashboardQuickActions, colors: colors, theme: theme),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: _QuickAction(
                icon: Icons.person_add_alt_1_rounded,
                label: l10n.brokerLeadNew,
                onTap: () => context.push('/broker/leads/new'),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _QuickAction(
                icon: Icons.bookmark_add_rounded,
                label: l10n.reservationNew,
                onTap: () => context.push('/broker/reservations/new'),
                accent: true,
              ),
            ),
          ],
        ),

        // ── Recent leads ──────────────────────────────────────────────────────
        if (data.recentLeads.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          _SectionLabel(
            label: l10n.brokerRecentLeads,
            colors: colors,
            theme: theme,
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final lead in data.recentLeads.take(5))
            _RecentLeadTile(lead: lead),
        ],

        // ── Recent reservations ───────────────────────────────────────────────
        if (data.recentReservations.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          _SectionLabel(
            label: l10n.brokerRecentReservations,
            colors: colors,
            theme: theme,
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final r in data.recentReservations.take(5))
            _RecentReservationTile(reservation: r),
        ],
      ],
    );
  }
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

class _KpiTile extends StatelessWidget {
  const _KpiTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.gradient,
    required this.iconColor,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final List<Color> gradient;
  final Color iconColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: gradient,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(18),
          border: onTap != null
              ? Border.all(color: AppPalette.gold300.withValues(alpha: 0.25))
              : null,
          boxShadow: [
            BoxShadow(
              color: gradient.last.withValues(alpha: 0.4),
              blurRadius: 16,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, size: 19, color: iconColor),
                ),
                if (onTap != null) ...[
                  const Spacer(),
                  Icon(
                    Icons.arrow_back_ios_new_rounded,
                    size: 11,
                    color: Colors.white.withValues(alpha: 0.4),
                  ),
                ],
              ],
            ),
            const Spacer(),
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w800,
                height: 1.0,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.65),
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.1,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Commission card ───────────────────────────────────────────────────────────

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
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF7C5200), Color(0xFF3D2800)],
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
          ),
          borderRadius: BorderRadius.circular(18),
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
                  color: AppPalette.gold300.withValues(alpha: 0.3),
                ),
              ),
              child: const Icon(
                Icons.payments_rounded,
                color: AppPalette.gold300,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.navCommissions,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'إجمالي العمولات',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.55),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              PriceFormatter.format(amount, languageCode: lang),
              style: const TextStyle(
                color: AppPalette.gold300,
                fontSize: 15,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.2,
              ),
            ),
            const SizedBox(width: 8),
            Icon(
              Icons.arrow_back_ios_new_rounded,
              color: Colors.white.withValues(alpha: 0.5),
              size: 13,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Quick action ──────────────────────────────────────────────────────────────

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.accent = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final gradient = accent
        ? const [Color(0xFF7C5200), Color(0xFF3D2800)]
        : const [_navyLight, _navyDeep];

    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 72,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: gradient,
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppPalette.gold300.withValues(alpha: 0.2)),
          boxShadow: [
            BoxShadow(
              color: gradient.last.withValues(alpha: 0.35),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: AppPalette.gold300, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  height: 1.25,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Section label ─────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({
    required this.label,
    required this.colors,
    required this.theme,
  });

  final String label;
  final AppColorsExt colors;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppPalette.gold400, AppPalette.gold300],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w800,
            color: colors.inkStrong,
          ),
        ),
      ],
    );
  }
}

// ── Recent lead tile ──────────────────────────────────────────────────────────

class _RecentLeadTile extends StatelessWidget {
  const _RecentLeadTile({required this.lead});
  final BrokerRecentLead lead;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: () => context.push('/broker/leads/${lead.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(14),
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
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_navyLight, _navyDeep],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(
                  lead.fullName.isNotEmpty
                      ? lead.fullName[0].toUpperCase()
                      : '?',
                  style: const TextStyle(
                    color: AppPalette.gold300,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                lead.fullName,
                style: theme.textTheme.titleSmall,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            StatusBadge(
              label: brokerLeadStatusLabel(l10n, lead.approvalStatus),
              tone: brokerLeadStatusTone(lead.approvalStatus),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Recent reservation tile ───────────────────────────────────────────────────

class _RecentReservationTile extends StatelessWidget {
  const _RecentReservationTile({required this.reservation});
  final BrokerRecentReservation reservation;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: () => context.push('/broker/reservations/${reservation.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(14),
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
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF7C5200), Color(0xFF3D2800)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.bookmark_rounded,
                color: AppPalette.gold300,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                reservation.reservationNumber ??
                    reservation.unitCode ??
                    l10n.navReservations,
                style: theme.textTheme.titleSmall,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            StatusBadge(
              label: reservationStatusLabel(l10n, reservation.status),
              tone: reservationStatusTone(reservation.status),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: AppSpacing.md,
            crossAxisSpacing: AppSpacing.md,
            childAspectRatio: 1.3,
            children: const [
              _KpiTile(
                icon: Icons.people_alt_rounded,
                label: 'العملاء المحتملون',
                value: '00',
                gradient: [_navyLight, _navyDeep],
                iconColor: AppPalette.gold300,
              ),
              _KpiTile(
                icon: Icons.verified_rounded,
                label: 'معتمدون',
                value: '00',
                gradient: [Color(0xFF0D5C3A), Color(0xFF052B1E)],
                iconColor: Color(0xFF4ADE80),
              ),
              _KpiTile(
                icon: Icons.bookmark_added_rounded,
                label: 'الحجوزات',
                value: '00',
                gradient: [Color(0xFF7C5200), Color(0xFF3D2800)],
                iconColor: AppPalette.gold300,
              ),
              _KpiTile(
                icon: Icons.check_circle_rounded,
                label: 'معتمدة',
                value: '00',
                gradient: [Color(0xFF0E3A6E), Color(0xFF071B35)],
                iconColor: Color(0xFF60A5FA),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Shared ────────────────────────────────────────────────────────────────────

class _DotTexture extends StatelessWidget {
  const _DotTexture();

  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
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
