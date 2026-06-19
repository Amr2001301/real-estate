import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/reservation_status_label.dart';
import '../../domain/entities/broker_reservation.dart';
import '../cubit/broker_reservations_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Broker Reservations Screen
// ─────────────────────────────────────────────────────────────────────────────

class BrokerReservationsScreen extends StatefulWidget {
  const BrokerReservationsScreen({super.key});

  @override
  State<BrokerReservationsScreen> createState() =>
      _BrokerReservationsScreenState();
}

class _BrokerReservationsScreenState
    extends State<BrokerReservationsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerReservationsCubit>().load();
  }

  Future<void> _create() async {
    final created = await context.push<bool>('/broker/reservations/new');
    if (created == true && mounted) {
      context.read<BrokerReservationsCubit>().load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerReservationsCubit>();

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: Column(
          children: [
            // ── Header ────────────────────────────────────────────────────────
            BlocBuilder<BrokerReservationsCubit, BrokerReservationsListState>(
              buildWhen: (a, b) =>
                  a.status != b.status ||
                  a.reservations.length != b.reservations.length,
              builder: (context, state) => _ReservationsHeader(
                l10n: l10n,
                count: state.status == DataStatus.success
                    ? state.reservations.length
                    : null,
                onAdd: _create,
              ),
            ),

            // ── Filter chips ──────────────────────────────────────────────────
            const SizedBox(height: AppSpacing.md),
            _StatusFilter(),

            // ── List ──────────────────────────────────────────────────────────
            Expanded(
              child: BlocBuilder<BrokerReservationsCubit,
                  BrokerReservationsListState>(
                builder: (context, state) {
                  switch (state.status) {
                    case DataStatus.initial:
                    case DataStatus.loading:
                      return const Center(child: CircularProgressIndicator());
                    case DataStatus.failure:
                      return ErrorState(
                        failure: state.failure,
                        onRetry: cubit.load,
                      );
                    case DataStatus.empty:
                      return EmptyState(
                        icon: Icons.bookmark_border_rounded,
                        title: l10n.reservationsEmptyTitle,
                        message: l10n.reservationsEmptyMessage,
                      );
                    case DataStatus.success:
                      return RefreshIndicator(
                        onRefresh: cubit.load,
                        child: ListView.separated(
                          padding: EdgeInsets.fromLTRB(
                            AppSpacing.lg,
                            AppSpacing.sm,
                            AppSpacing.lg,
                            AppSpacing.xl +
                                MediaQuery.of(context).padding.bottom,
                          ),
                          itemCount: state.reservations.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: AppSpacing.sm),
                          itemBuilder: (context, i) =>
                              _ReservationCard(reservation: state.reservations[i]),
                        ),
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

// ── Header ────────────────────────────────────────────────────────────────────

class _ReservationsHeader extends StatelessWidget {
  const _ReservationsHeader({
    required this.l10n,
    required this.onAdd,
    this.count,
  });

  final AppLocalizations l10n;
  final int? count;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
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
              width: 160,
              height: 120,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.09),
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
              AppSpacing.lg,
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
                        l10n.navReservations,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'طلبات الحجز المقدمة',
                        style: TextStyle(
                          color: AppPalette.gold300,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                if (count != null) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Text(
                      '$count',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                ],
                GestureDetector(
                  onTap: onAdd,
                  child: Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppPalette.gold400, AppPalette.gold300],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: AppPalette.gold400.withValues(alpha: 0.4),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.add_rounded,
                      color: _navyDeep,
                      size: 22,
                    ),
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

// ── Status filter ─────────────────────────────────────────────────────────────

class _StatusFilter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerReservationsCubit>();
    return SizedBox(
      height: 44,
      child: BlocBuilder<BrokerReservationsCubit, BrokerReservationsListState>(
        buildWhen: (a, b) => a.statusFilter != b.statusFilter,
        builder: (context, state) => ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          children: [
            _FilterChip(
              label: l10n.leadsFilterAll,
              selected: state.statusFilter == null,
              onTap: () => cubit.setStatus(null),
              dotColor: _navyCard,
            ),
            for (final s in kReservationStatuses)
              _FilterChip(
                label: reservationStatusLabel(l10n, s),
                selected: state.statusFilter == s,
                onTap: () => cubit.setStatus(s),
                dotColor: _reservationColor(s),
              ),
          ],
        ),
      ),
    );
  }

  Color _reservationColor(String s) {
    switch (s) {
      case 'approved':
        return const Color(0xFF22C55E);
      case 'converted':
        return const Color(0xFF60A5FA);
      case 'expired':
      case 'cancelled':
        return const Color(0xFFEF4444);
      default:
        return AppPalette.gold300;
    }
  }
}

// ── Filter chip ───────────────────────────────────────────────────────────────

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    required this.dotColor,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color dotColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          gradient: selected
              ? const LinearGradient(
                  colors: [_navyLight, _navyDeep],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: selected ? null : colors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected
                ? Colors.transparent
                : colors.hairline.withValues(alpha: 0.6),
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: _navyDeep.withValues(alpha: 0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                color: selected ? AppPalette.gold300 : dotColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : colors.inkStrong,
                fontWeight: FontWeight.w700,
                fontSize: 12.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Reservation card ──────────────────────────────────────────────────────────

class _ReservationCard extends StatelessWidget {
  const _ReservationCard({required this.reservation});
  final BrokerReservation reservation;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: () => context.push(
        '/broker/reservations/${reservation.id}',
        extra: reservation,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.hairline.withValues(alpha: 0.4)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: IntrinsicHeight(
          child: Row(
            children: [
              // Left accent rail
              Container(
                width: 4,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      _statusColor(reservation.status),
                      _statusColor(reservation.status).withValues(alpha: 0.3),
                    ],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    bottomLeft: Radius.circular(16),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Icon
              Container(
                width: 40,
                height: 40,
                margin: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF7C5200), Color(0xFF3D2800)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: const Icon(
                  Icons.bookmark_rounded,
                  color: AppPalette.gold300,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              // Content
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        reservation.reservationNumber ??
                            reservation.clientName ??
                            l10n.navReservations,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (reservation.unitCode != null ||
                          reservation.projectName != null) ...[
                        const SizedBox(height: 3),
                        Text(
                          [
                            if (reservation.unitCode != null)
                              reservation.unitCode!,
                            if (reservation.projectName != null)
                              reservation.projectName!,
                          ].join(' · '),
                          style: theme.textTheme.bodySmall?.copyWith(
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
              ),
              Padding(
                padding: const EdgeInsets.only(right: 14),
                child: StatusBadge(
                  label: reservationStatusLabel(l10n, reservation.status),
                  tone: reservationStatusTone(reservation.status),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'approved':
        return const Color(0xFF22C55E);
      case 'converted':
        return const Color(0xFF60A5FA);
      case 'expired':
      case 'cancelled':
        return const Color(0xFFEF4444);
      default:
        return AppPalette.gold300;
    }
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
