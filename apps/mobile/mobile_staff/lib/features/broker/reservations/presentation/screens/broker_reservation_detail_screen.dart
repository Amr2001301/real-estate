import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/reservation_status_label.dart';
import '../../domain/entities/broker_reservation.dart';
import '../cubit/broker_reservation_detail_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Broker Reservation Detail Screen
// ─────────────────────────────────────────────────────────────────────────────

class BrokerReservationDetailScreen extends StatefulWidget {
  const BrokerReservationDetailScreen({super.key, this.fallback});
  final BrokerReservation? fallback;

  @override
  State<BrokerReservationDetailScreen> createState() => _State();
}

class _State extends State<BrokerReservationDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerReservationDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocBuilder<BrokerReservationDetailCubit,
            BrokerReservationDetailState>(
          builder: (context, state) {
            switch (state.status) {
              case DataStatus.initial:
              case DataStatus.loading:
                return Column(
                  children: [
                    _ReservationHeader(
                      number: widget.fallback?.reservationNumber,
                    ),
                    const Expanded(
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  ],
                );
              case DataStatus.failure:
                return Column(
                  children: [
                    _ReservationHeader(
                      number: widget.fallback?.reservationNumber,
                    ),
                    Expanded(
                      child: ErrorState(
                        failure: state.failure,
                        onRetry: () => context
                            .read<BrokerReservationDetailCubit>()
                            .load(),
                      ),
                    ),
                  ],
                );
              case DataStatus.empty:
              case DataStatus.success:
                return _Body(detail: state.data!);
            }
          },
        ),
      ),
    );
  }
}

// ── Body ──────────────────────────────────────────────────────────────────────

class _Body extends StatelessWidget {
  const _Body({required this.detail});
  final BrokerReservationDetail detail;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final r = detail.reservation;
    final isExpired =
        r.expiresAt != null && r.expiresAt!.isBefore(DateTime.now());

    return Column(
      children: [
        _ReservationHeader(
          number: r.reservationNumber,
          status: r.status,
          l10n: l10n,
        ),
        Expanded(
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.xl + MediaQuery.of(context).padding.bottom,
            ),
            children: [
              // ── Summary card ──────────────────────────────────────────────
              Container(
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: colors.hairline.withValues(alpha: 0.4),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Unit/Project row
                      if (r.unitCode != null) ...[
                        _InfoRow(
                          icon: Icons.home_work_rounded,
                          label: l10n.reservationUnit,
                          value:
                              '${r.unitCode}${r.projectName != null ? ' · ${r.projectName}' : ''}',
                        ),
                        Divider(
                          height: AppSpacing.lg,
                          color: colors.hairline,
                        ),
                      ],

                      // Lead name
                      if (detail.leadName != null) ...[
                        _InfoRow(
                          icon: Icons.person_rounded,
                          label: l10n.navLeads,
                          value: detail.leadName!,
                        ),
                        Divider(
                          height: AppSpacing.lg,
                          color: colors.hairline,
                        ),
                      ],

                      // Booking amount
                      if (detail.bookingAmount != null) ...[
                        _InfoRow(
                          icon: Icons.payments_rounded,
                          label: l10n.reservationBooking,
                          value: PriceFormatter.formatString(
                            detail.bookingAmount,
                            languageCode: lang,
                          ),
                          valueColor: AppPalette.gold300,
                        ),
                        Divider(
                          height: AppSpacing.lg,
                          color: colors.hairline,
                        ),
                      ],

                      // Expiry
                      if (r.expiresAt != null) ...[
                        _InfoRow(
                          icon: Icons.schedule_rounded,
                          label: isExpired
                              ? l10n.reservationExpiredOn
                              : l10n.reservationExpiresOn,
                          value: DateFormatter.mediumDate(
                            r.expiresAt!,
                            languageCode: lang,
                          ),
                          valueColor: isExpired
                              ? colors.error
                              : const Color(0xFFFBBF24),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // ── Expiry badge ──────────────────────────────────────────────
              if (r.expiresAt != null) ...[
                const SizedBox(height: AppSpacing.md),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: isExpired
                        ? colors.error.withValues(alpha: 0.08)
                        : const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isExpired
                          ? colors.error.withValues(alpha: 0.2)
                          : const Color(0xFFFDE68A),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isExpired
                            ? Icons.error_outline_rounded
                            : Icons.info_outline_rounded,
                        size: 16,
                        color: isExpired
                            ? colors.error
                            : const Color(0xFFD97706),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isExpired
                            ? '${l10n.reservationExpiredOn}: ${DateFormatter.shortDate(r.expiresAt!, languageCode: lang)}'
                            : '${l10n.reservationExpiresOn}: ${DateFormatter.shortDate(r.expiresAt!, languageCode: lang)}',
                        style: TextStyle(
                          color: isExpired
                              ? colors.error
                              : const Color(0xFFD97706),
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

// ── Reservation header ────────────────────────────────────────────────────────

class _ReservationHeader extends StatelessWidget {
  const _ReservationHeader({this.number, this.status, this.l10n});

  final String? number;
  final String? status;
  final AppLocalizations? l10n;

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
              AppSpacing.xl,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _BackBtn(),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        number ?? '—',
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                          letterSpacing: 0.3,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'تفاصيل طلب الحجز',
                        style: TextStyle(
                          color: AppPalette.gold300,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                if (status != null && l10n != null) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.25),
                      ),
                    ),
                    child: Text(
                      reservationStatusLabel(l10n!, status!),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Info row ──────────────────────────────────────────────────────────────────

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: _navyDeep.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Icon(icon, size: 16, color: colors.inkMuted),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: colors.inkMuted,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: valueColor ?? colors.inkStrong,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Shared ────────────────────────────────────────────────────────────────────

class _BackBtn extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.white,
          size: 16,
        ),
      ),
    );
  }
}

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
