import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../common/reservation_status_label.dart';
import '../../domain/entities/broker_reservation.dart';
import '../cubit/broker_reservation_detail_cubit.dart';

const _navyDeep = Color(0xFF0B1726);

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
                    Expanded(child: _DetailSkeleton()),
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
    return AppNavHeader(
      title: number != null ? ltr(number) : 'تفاصيل طلب الحجز',
      subtitle: number != null ? 'تفاصيل طلب الحجز' : null,
      compact: true,
      leadingAction: const NavHeaderBack(),
      actions: [
        if (status != null && l10n != null) NavHeaderPill(label: reservationStatusLabel(l10n!, status!)),
      ],
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

// ── Reservation detail loading skeleton ───────────────────────────────────────

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return AppSkeletonizer(
      enabled: true,
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.lg, AppSpacing.lg,
          AppSpacing.xl + bottomPad,
        ),
        children: [
          // ── Fake summary card (unit / lead / amount / expiry) ─────────────
          Container(
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: colors.hairline.withValues(alpha: 0.4)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                for (int i = 0; i < 4; i++) ...[
                  if (i > 0) Divider(height: AppSpacing.lg, color: colors.hairline),
                  Row(children: [
                    Icon(
                      [
                        Icons.home_work_rounded,
                        Icons.person_rounded,
                        Icons.payments_rounded,
                        Icons.schedule_rounded,
                      ][i],
                      size: 18, color: colors.inkMuted,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      ['الوحدة', 'العميل', 'مبلغ الحجز', 'تاريخ الانتهاء'][i],
                      style: TextStyle(fontSize: 13, color: colors.inkMuted),
                    ),
                    const Spacer(),
                    Text(
                      ['A-102 · كمبوند الرياض', 'محمد أحمد العمري', '100,000 ${PriceFormatter.symbol('ar')}', '15/06/2026'][i],
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.inkStrong),
                    ),
                  ]),
                ],
              ]),
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          // ── Fake deposit / payment card ───────────────────────────────────
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: colors.hairline.withValues(alpha: 0.4)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('الدفعة', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.inkStrong)),
              const SizedBox(height: AppSpacing.md),
              Row(children: [
                Icon(Icons.receipt_long_rounded, size: 18, color: colors.inkMuted),
                const SizedBox(width: AppSpacing.sm),
                Text('حالة الدفعة', style: TextStyle(fontSize: 13, color: colors.inkMuted)),
                const Spacer(),
                StatusBadge(label: 'قيد المراجعة', tone: BadgeTone.warning),
              ]),
              Divider(height: AppSpacing.lg, color: colors.hairline),
              Row(children: [
                Icon(Icons.attach_money_rounded, size: 18, color: colors.inkMuted),
                const SizedBox(width: AppSpacing.sm),
                Text('المبلغ', style: TextStyle(fontSize: 13, color: colors.inkMuted)),
                const Spacer(),
                Text('100,000 ${PriceFormatter.symbol('ar')}',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.brandGold)),
              ]),
            ]),
          ),
        ],
      ),
    );
  }
}
