import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../common/reservation_status_label.dart';
import '../../domain/entities/broker_reservation.dart';
import '../cubit/broker_reservation_detail_cubit.dart';

/// Broker reservation detail (read-only): status, expiry, unit/project, lead.
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
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(widget.fallback?.reservationNumber ?? l10n.navReservations)),
      body: BlocBuilder<BrokerReservationDetailCubit, BrokerReservationDetailState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(failure: state.failure, onRetry: () => context.read<BrokerReservationDetailCubit>().load());
            case DataStatus.empty:
            case DataStatus.success:
              return _Body(detail: state.data!);
          }
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.detail});
  final BrokerReservationDetail detail;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final r = detail.reservation;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        AppCard(
          elevation: AppCardElevation.soft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(r.reservationNumber ?? l10n.navReservations, style: Theme.of(context).textTheme.titleLarge)),
                  StatusBadge(label: reservationStatusLabel(l10n, r.status), tone: reservationStatusTone(r.status)),
                ],
              ),
              if (r.unitCode != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text('${r.unitCode}${r.projectName != null ? ' · ${r.projectName}' : ''}',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted)),
              ],
              if (detail.leadName != null) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text('${l10n.navLeads}: ${detail.leadName}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
              if (detail.bookingAmount != null) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text('${l10n.reservationBooking}: ${PriceFormatter.formatString(detail.bookingAmount, languageCode: lang)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
              if (r.expiresAt != null) ...[
                const SizedBox(height: AppSpacing.sm),
                StatusBadge(
                  label: '${r.expiresAt!.isBefore(DateTime.now()) ? l10n.reservationExpiredOn : l10n.reservationExpiresOn}: '
                      '${DateFormatter.shortDate(r.expiresAt!, languageCode: lang)}',
                  tone: r.expiresAt!.isBefore(DateTime.now()) ? BadgeTone.error : BadgeTone.warning,
                  dot: true,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
