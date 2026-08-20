import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/reservation_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/reservation.dart';
import '../cubit/reservations_cubit.dart';

/// Reservations list with status filter chips and create FAB.
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
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add_rounded),
        label: Text(l10n.reservationNew),
      ),
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.navReservations,
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
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        itemCount: state.reservations.length,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) => _ReservationTile(reservation: state.reservations[i]),
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
    final cubit = context.read<ReservationsCubit>();
    return SizedBox(
      height: 48,
      child: BlocBuilder<ReservationsCubit, ReservationsListState>(
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

class _ReservationTile extends StatelessWidget {
  const _ReservationTile({required this.reservation});
  final Reservation reservation;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return AppCard(
      onTap: () => context.push('/reservations/${reservation.id}', extra: reservation),
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
