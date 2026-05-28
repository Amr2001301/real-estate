import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/reservation_status_label.dart';
import '../../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/broker_reservation.dart';
import '../cubit/broker_reservations_cubit.dart';

/// Broker reservation requests list with status filter chips + create FAB.
class BrokerReservationsScreen extends StatefulWidget {
  const BrokerReservationsScreen({super.key});

  @override
  State<BrokerReservationsScreen> createState() => _BrokerReservationsScreenState();
}

class _BrokerReservationsScreenState extends State<BrokerReservationsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerReservationsCubit>().load();
  }

  Future<void> _create() async {
    final created = await context.push<bool>('/broker/reservations/new');
    if (created == true && mounted) context.read<BrokerReservationsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerReservationsCubit>();
    return Scaffold(
      appBar: AppBar(title: Text(l10n.navReservations)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add_rounded),
        label: Text(l10n.reservationNew),
      ),
      body: Column(
        children: [
          _StatusFilter(),
          Expanded(
            child: BlocBuilder<BrokerReservationsCubit, BrokerReservationsListState>(
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
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        itemCount: state.reservations.length,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) => _Tile(reservation: state.reservations[i]),
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

class _StatusFilter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerReservationsCubit>();
    return SizedBox(
      height: 48,
      child: BlocBuilder<BrokerReservationsCubit, BrokerReservationsListState>(
        buildWhen: (a, b) => a.statusFilter != b.statusFilter,
        builder: (context, state) => ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
              child: ChoiceChip(
                label: Text(l10n.leadsFilterAll),
                selected: state.statusFilter == null,
                onSelected: (_) => cubit.setStatus(null),
              ),
            ),
            for (final s in kReservationStatuses)
              Padding(
                padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
                child: ChoiceChip(
                  label: Text(reservationStatusLabel(l10n, s)),
                  selected: state.statusFilter == s,
                  onSelected: (_) => cubit.setStatus(s),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.reservation});
  final BrokerReservation reservation;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return AppCard(
      onTap: () => context.push('/broker/reservations/${reservation.id}', extra: reservation),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  reservation.reservationNumber ?? reservation.clientName ?? l10n.navReservations,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    if (reservation.unitCode != null) reservation.unitCode!,
                    if (reservation.projectName != null) reservation.projectName!,
                  ].join(' · '),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          StatusBadge(
            label: reservationStatusLabel(l10n, reservation.status),
            tone: reservationStatusTone(reservation.status),
          ),
        ],
      ),
    );
  }
}
