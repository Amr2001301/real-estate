import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/reservation.dart';

/// Who decides on a pending reservation, as on the dashboard (F17): the admin,
/// or a sales manager on a rep's booking — never on their own. The API checks
/// the same (team scope and the reservations:approve / :reject codes).
bool canDecideReservation(Reservation r, {required AppRole? role, required String? userId}) {
  if (r.status != 'PENDING') return false;
  if (role == AppRole.admin) return true;
  return role == AppRole.salesManager && r.salesId != null && r.salesId != userId;
}

/// «مستني موافقتك» — approve or reject a team member's booking.
class ReservationDecisionCard extends StatelessWidget {
  const ReservationDecisionCard({
    super.key,
    required this.reservation,
    required this.working,
    required this.onApprove,
    required this.onReject,
  });

  final Reservation reservation;
  final bool working;
  final VoidCallback onApprove;
  final ValueChanged<String?> onReject;

  Future<void> _confirmApprove(BuildContext context) async {
    final l10n = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.reservationApproveConfirm),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(l10n.actionCancel)),
          FilledButton(
            key: const ValueKey('reservation-approve-confirm'),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.reservationApprove),
          ),
        ],
      ),
    );
    if (ok == true) onApprove();
  }

  Future<void> _askReject(BuildContext context) async {
    // null: cancelled; otherwise the reason typed (may be blank).
    final reason = await showDialog<String>(context: context, builder: (_) => const _RejectDialog());
    if (reason != null) onReject(reason);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return Container(
      key: const ValueKey('reservation-decision'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: AppPalette.gold400.withValues(alpha: 0.6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            const Icon(Icons.how_to_reg_rounded, color: AppPalette.gold500),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                l10n.reservationDecideTitle,
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.inkStrong),
              ),
            ),
          ]),
          if (reservation.salesName != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(l10n.reservationBookedBy(reservation.salesName!),
                style: TextStyle(fontSize: 13, color: colors.inkMuted)),
          ],
          const SizedBox(height: AppSpacing.sm),
          Text(l10n.reservationDecideDesc, style: TextStyle(fontSize: 13, color: colors.inkMuted)),
          const SizedBox(height: AppSpacing.md),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                key: const ValueKey('reservation-reject'),
                onPressed: working ? null : () => _askReject(context),
                child: Text(l10n.reservationReject),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: FilledButton(
                key: const ValueKey('reservation-approve'),
                onPressed: working ? null : () => _confirmApprove(context),
                child: Text(l10n.reservationApprove),
              ),
            ),
          ]),
        ],
      ),
    );
  }
}

/// Owns its text box, so it lives exactly as long as the dialog does.
class _RejectDialog extends StatefulWidget {
  const _RejectDialog();

  @override
  State<_RejectDialog> createState() => _RejectDialogState();
}

class _RejectDialogState extends State<_RejectDialog> {
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.reservationRejectTitle),
      content: TextField(
        key: const ValueKey('reservation-reject-reason'),
        controller: _reason,
        minLines: 1,
        maxLines: 3,
        decoration: InputDecoration(hintText: l10n.reservationRejectReasonHint),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(l10n.actionCancel)),
        FilledButton(
          key: const ValueKey('reservation-reject-confirm'),
          style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
          onPressed: () => Navigator.of(context).pop(_reason.text),
          child: Text(l10n.reservationReject),
        ),
      ],
    );
  }
}

/// The reject dialog on its own (the bookings list and page): null when
/// dismissed, else the reason typed (may be blank).
Future<String?> askReservationRejectReason(BuildContext context) =>
    showDialog<String>(context: context, builder: (_) => const _RejectDialog());

/// «الموافقة على هذا الحجز؟» on its own.
Future<bool> confirmReservationApprove(BuildContext context) async {
  final l10n = context.l10n;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(l10n.reservationApproveConfirm),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(l10n.actionCancel)),
        FilledButton(
          key: const ValueKey('reservation-approve-confirm'),
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(l10n.reservationApprove),
        ),
      ],
    ),
  );
  return ok == true;
}
