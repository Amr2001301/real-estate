import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/reservation_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/reservation.dart';
import '../cubit/reservations_cubit.dart';

class ReservationsScreen extends StatefulWidget {
  const ReservationsScreen({super.key});

  @override
  State<ReservationsScreen> createState() => _ReservationsScreenState();
}

class _ReservationsScreenState extends State<ReservationsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ReservationsCubit>().load();
  }

  Future<void> _create() async {
    final created = await context.push<bool>('/reservations/new');
    if (created == true && mounted) context.read<ReservationsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ReservationsCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.navReservations,
            compact: true,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          _StatusFilter(),
          Expanded(
            child: BlocBuilder<ReservationsCubit, ReservationsListState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
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
                          AppSpacing.md,
                          AppSpacing.sm,
                          AppSpacing.md,
                          bottomPad + 100,
                        ),
                        itemCount: state.reservations.length,
                        separatorBuilder: (_, i) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) =>
                            _ReservationTile(reservation: state.reservations[i]),
                      ),
                    );
                }
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _create,
        tooltip: l10n.reservationNew,
        child: const Icon(Icons.add_rounded),
      ),
    );
  }
}

// ── Status filter bar ─────────────────────────────────────────────────────────

const _kReservationDotColors = <String, Color>{
  'PENDING': Color(0xFFF59E0B),    // amber
  'APPROVED': Color(0xFF60A5FA),   // blue
  'CONVERTED': Color(0xFF22C55E),  // green
  'REJECTED': Color(0xFFEF4444),   // red
  'CANCELLED': Color(0xFFEF4444),  // red
  'EXPIRED': Color(0xFF9CA3AF),    // muted gray
};

class _StatusFilter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ReservationsCubit>();
    final colors = context.appColors;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(bottom: BorderSide(color: colors.hairline, width: 0.5)),
      ),
      child: BlocBuilder<ReservationsCubit, ReservationsListState>(
        buildWhen: (a, b) => a.statusFilter != b.statusFilter,
        builder: (context, state) => SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: 6,
          ),
          child: Row(
            children: [
              _StatusChip(
                label: l10n.leadsFilterAll,
                active: state.statusFilter == null,
                onTap: () => cubit.setStatus(null),
              ),
              for (final s in kReservationStatuses) ...[
                const SizedBox(width: AppSpacing.xs),
                _StatusChip(
                  label: reservationStatusLabel(l10n, s),
                  active: state.statusFilter == s,
                  dotColor: _kReservationDotColors[s],
                  onTap: () => cubit.setStatus(s),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.active,
    required this.onTap,
    this.dotColor,
  });
  final String label;
  final bool active;
  final VoidCallback onTap;
  final Color? dotColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm + 4,
          vertical: 11,
        ),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(
            color: active ? colors.brandNavy : colors.hairline,
            width: active ? 0 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!active && dotColor != null) ...[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: AppSpacing.xxs + 2),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                color: active ? Colors.white : colors.inkStrong,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Reservation tile ──────────────────────────────────────────────────────────

class _ReservationTile extends StatefulWidget {
  const _ReservationTile({required this.reservation});
  final Reservation reservation;

  @override
  State<_ReservationTile> createState() => _ReservationTileState();
}

class _ReservationTileState extends State<_ReservationTile> {
  bool _pressed = false;
  Reservation get r => widget.reservation;

  static Color _toneColor(BadgeTone tone, AppColorsExt c) => switch (tone) {
        BadgeTone.success => c.success,
        BadgeTone.warning => c.warning,
        BadgeTone.error => c.error,
        BadgeTone.info => c.info,
        BadgeTone.gold => c.brandGold,
        _ => c.inkMuted,
      };

  static IconData _statusIcon(String status) => switch (status) {
        'PENDING' => Icons.hourglass_top_rounded,
        'APPROVED' => Icons.verified_rounded,
        'CONVERTED' => Icons.check_circle_rounded,
        'REJECTED' => Icons.cancel_rounded,
        'CANCELLED' => Icons.cancel_outlined,
        'EXPIRED' => Icons.timer_off_rounded,
        _ => Icons.bookmark_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final isRtl = context.read<LocaleCubit>().isRtl;
    final tone = reservationStatusTone(r.status);
    final accent = _toneColor(tone, colors);

    final primaryLabel = r.reservationNumber ?? r.clientName ?? l10n.navReservations;
    final hasClient = r.clientName != null && r.reservationNumber != null;
    final hasUnit = r.unitCode != null;
    final hasProject = r.projectName != null;
    final hasDate = r.createdAt != null;
    final hasExpiry = r.expiresAt != null;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => context.push('/reservations/${r.id}', extra: r),
      child: AnimatedScale(
        scale: _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadii.card,
            border: Border.all(
              color: accent.withValues(alpha: 0.16),
              width: 0.9,
            ),
            boxShadow: [
              BoxShadow(
                color: accent.withValues(alpha: 0.10),
                blurRadius: 20,
                offset: const Offset(0, 6),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Status-coloured accent strip ───────────────────────────
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
              // ── Card body ─────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  13,
                  AppSpacing.md,
                  13,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Main row: icon · content · badge · chevron ─────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Status icon circle
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: 0.10),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: accent.withValues(alpha: 0.28),
                              width: 1.2,
                            ),
                          ),
                          child: Icon(
                            _statusIcon(r.status),
                            color: accent,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        // Reservation number + client name
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                primaryLabel,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 15.5,
                                  fontWeight: FontWeight.w700,
                                  color: colors.inkStrong,
                                  height: 1.2,
                                  letterSpacing: -0.2,
                                ),
                              ),
                              if (hasClient) ...[
                                const SizedBox(height: 3),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.person_outline_rounded,
                                      size: 11,
                                      color: colors.inkMuted,
                                    ),
                                    const SizedBox(width: 3),
                                    Expanded(
                                      child: Text(
                                        r.clientName!,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: colors.inkMuted,
                                          height: 1.3,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ] else if (hasProject) ...[
                                const SizedBox(height: 3),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.apartment_rounded,
                                      size: 11,
                                      color: colors.inkMuted,
                                    ),
                                    const SizedBox(width: 3),
                                    Expanded(
                                      child: Text(
                                        r.projectName!,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: colors.inkMuted,
                                          height: 1.3,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Badge + chevron
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            StatusBadge(
                              label: reservationStatusLabel(l10n, r.status),
                              tone: tone,
                            ),
                            const SizedBox(height: 4),
                            Icon(
                              Icons.chevron_right_rounded,
                              size: 16,
                              color: colors.inkMuted.withValues(alpha: 0.5),
                            ),
                          ],
                        ),
                      ],
                    ),
                    // ── Info chips row ─────────────────────────────────
                    if (hasDate || hasUnit || hasProject) ...[
                      const SizedBox(height: 10),
                      Container(height: 0.5, color: colors.hairline),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          if (hasDate)
                            _InfoChip(
                              icon: Icons.calendar_today_rounded,
                              label: DateFormatter.shortDate(
                                r.createdAt!,
                                languageCode: lang,
                              ),
                              color: colors.brandNavy,
                            ),
                          if (hasDate && hasUnit)
                            const SizedBox(width: 6),
                          if (hasUnit)
                            _InfoChip(
                              icon: Icons.apartment_rounded,
                              label: r.unitCode!,
                              color: colors.brandGold,
                            ),
                          if ((hasDate || hasUnit) && hasProject && r.projectName != null)
                            const SizedBox(width: 6),
                          if (hasProject && !hasClient)
                            const SizedBox.shrink()
                          else if (hasProject)
                            Expanded(
                              child: _InfoChip(
                                icon: Icons.location_city_rounded,
                                label: r.projectName!,
                                color: colors.inkMuted,
                              ),
                            ),
                          if (hasExpiry && r.status == 'PENDING') ...[
                            if (hasDate || hasUnit) const SizedBox(width: 6),
                            _InfoChip(
                              icon: Icons.timer_outlined,
                              label: DateFormatter.shortDate(
                                r.expiresAt!,
                                languageCode: lang,
                              ),
                              color: colors.warning,
                            ),
                          ],
                        ],
                      ),
                    ],
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

// ── Info chip (identical to visits screen) ────────────────────────────────────

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.icon,
    required this.label,
    required this.color,
  });
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        border: Border.all(color: color.withValues(alpha: 0.20)),
        borderRadius: AppRadii.pillAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color.withValues(alpha: 0.80)),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: color,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}
