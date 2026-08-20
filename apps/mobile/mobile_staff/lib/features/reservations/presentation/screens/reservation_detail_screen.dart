import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/reservation_status_label.dart';
import '../../../../common/staff_contact_actions.dart';
import '../../domain/entities/reservation.dart';
import '../cubit/reservation_detail_cubit.dart';

/// Reservation detail: summary + expiry, contact, add note, and timeline.
/// Status transitions (approve/reject/convert) are ADMIN-only → not shown.
class ReservationDetailScreen extends StatefulWidget {
  const ReservationDetailScreen({super.key, this.fallback});
  final Reservation? fallback;

  @override
  State<ReservationDetailScreen> createState() => _ReservationDetailScreenState();
}

class _ReservationDetailScreenState extends State<ReservationDetailScreen> {
  final _note = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<ReservationDetailCubit>().load();
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _submitNote() {
    if (_note.text.trim().isEmpty) return;
    context.read<ReservationDetailCubit>().addNote(_note.text);
    _note.clear();
    FocusScope.of(context).unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      body: Column(
        children: [
          BlocBuilder<ReservationDetailCubit, ReservationDetailState>(
            buildWhen: (a, b) =>
                a.detail?.reservation.reservationNumber !=
                b.detail?.reservation.reservationNumber,
            builder: (context, state) => AppNavHeader(
              title: state.detail?.reservation.reservationNumber
                  ?? widget.fallback?.reservationNumber
                  ?? l10n.navReservations,
              leadingAction: NavHeaderAction(
                icon: Icons.arrow_back_ios_new_rounded,
                onTap: () => context.pop(),
              ),
            ),
          ),
          Expanded(
            child: BlocConsumer<ReservationDetailCubit, ReservationDetailState>(
              listenWhen: (a, b) => a.actionFailure != b.actionFailure && b.actionFailure != null,
              listener: (context, state) => showFailureSnackBar(context, state.actionFailure!),
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const Center(child: CircularProgressIndicator());
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: () => context.read<ReservationDetailCubit>().load());
                  case DataStatus.empty:
                  case DataStatus.success:
                    return _body(context, state);
                }
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(BuildContext context, ReservationDetailState state) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final detail = state.detail!;
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
                  Expanded(
                    child: Text(r.reservationNumber ?? l10n.navReservations,
                        style: Theme.of(context).textTheme.titleLarge),
                  ),
                  StatusBadge(
                    label: reservationStatusLabel(l10n, r.status),
                    tone: reservationStatusTone(r.status),
                  ),
                ],
              ),
              if (r.unitCode != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text('${r.unitCode}${r.projectName != null ? ' · ${r.projectName}' : ''}',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted)),
              ],
              if (r.clientName != null) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text(r.clientName!, style: Theme.of(context).textTheme.bodyMedium),
              ],
              if (r.bookingAmount != null) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text('${l10n.reservationBooking}: '
                    '${PriceFormatter.formatString(r.bookingAmount, languageCode: lang)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
              if (detail.planName != null) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text('${l10n.reservationPlan}: ${detail.planName}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
              if (r.expiresAt != null) ...[
                const SizedBox(height: AppSpacing.sm),
                _ExpiryChip(expiresAt: r.expiresAt!),
              ],
              const SizedBox(height: AppSpacing.md),
              StaffContactButtons(phone: r.clientPhone),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(l10n.leadAddNote, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: TextField(
                controller: _note,
                minLines: 1,
                maxLines: 3,
                decoration: InputDecoration(hintText: l10n.leadNoteHint, isDense: true),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            IconButton.filled(
              onPressed: state.working ? null : _submitNote,
              icon: const Icon(Icons.send_rounded),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(l10n.leadTimeline, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        if (detail.timeline.isEmpty)
          Text(l10n.leadTimelineEmpty,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted))
        else
          for (final e in detail.timeline) ...[
            AppCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(e.isNote ? Icons.sticky_note_2_outlined : Icons.history_rounded,
                      size: 18, color: e.isNote ? colors.brandGold : colors.inkMuted),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          e.isNote ? e.body : reservationStatusLabel(l10n, e.body),
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        if (e.createdAt != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            [
                              if (e.authorName != null) e.authorName!,
                              DateFormatter.shortDate(e.createdAt!, languageCode: lang),
                            ].join(' · '),
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.inkMuted),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
      ],
    );
  }
}

class _ExpiryChip extends StatelessWidget {
  const _ExpiryChip({required this.expiresAt});
  final DateTime expiresAt;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final expired = expiresAt.isBefore(DateTime.now());
    return StatusBadge(
      label: '${expired ? l10n.reservationExpiredOn : l10n.reservationExpiresOn}: '
          '${DateFormatter.shortDate(expiresAt, languageCode: lang)}',
      tone: expired ? BadgeTone.error : BadgeTone.warning,
      dot: true,
    );
  }
}
