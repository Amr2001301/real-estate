import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/entities/visit_request.dart';
import 'my_visits_cubit.dart';

extension on VisitStatus {
  String label(AppLocalizations l) => switch (this) {
        VisitStatus.pending => l.visitStatusPending,
        VisitStatus.approved => l.visitStatusApproved,
        VisitStatus.scheduled => l.visitStatusScheduled,
        VisitStatus.completed => l.visitStatusCompleted,
        VisitStatus.cancelled => l.visitStatusCancelled,
        VisitStatus.unknown => '',
      };

  BadgeTone get tone => switch (this) {
        VisitStatus.pending => BadgeTone.warning,
        VisitStatus.approved => BadgeTone.info,
        VisitStatus.scheduled => BadgeTone.gold,
        VisitStatus.completed => BadgeTone.success,
        VisitStatus.cancelled => BadgeTone.error,
        VisitStatus.unknown => BadgeTone.neutral,
      };
}

extension on AppointmentStatus {
  /// Customer-facing label. SCHEDULED reads as "awaiting your confirmation"
  /// (this is the two-sided flow's customer side); CONFIRMED reads as
  /// "confirmed by you", etc.
  String customerLabel(AppLocalizations l) => switch (this) {
        AppointmentStatus.scheduled => l.appointmentStatusAwaitingCustomer,
        AppointmentStatus.confirmed => l.appointmentStatusConfirmedByCustomer,
        AppointmentStatus.pendingReschedule =>
          l.appointmentStatusPendingRescheduleCustomer,
        AppointmentStatus.completed => l.visitStatusCompleted,
        AppointmentStatus.cancelled => l.visitStatusCancelled,
        AppointmentStatus.noShow => l.visitStatusNoShow,
        AppointmentStatus.rescheduled => l.visitStatusRescheduled,
        AppointmentStatus.unknown => '',
      };

  BadgeTone get tone => switch (this) {
        AppointmentStatus.scheduled => BadgeTone.warning,
        AppointmentStatus.confirmed => BadgeTone.success,
        AppointmentStatus.pendingReschedule => BadgeTone.gold,
        AppointmentStatus.completed => BadgeTone.success,
        AppointmentStatus.cancelled => BadgeTone.error,
        AppointmentStatus.noShow => BadgeTone.error,
        AppointmentStatus.rescheduled => BadgeTone.neutral,
        AppointmentStatus.unknown => BadgeTone.neutral,
      };
}

class MyRequestsScreen extends StatefulWidget {
  const MyRequestsScreen({super.key});

  @override
  State<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends State<MyRequestsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<MyVisitsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.myRequestsTitle)),
      body: BlocConsumer<MyVisitsCubit, MyVisitsState>(
        // Fire a SnackBar exactly once per fresh action outcome — equality is
        // identity-based, so even repeat outcomes flip the field reference.
        listenWhen: (a, b) =>
            !identical(a.lastOutcome, b.lastOutcome) && b.lastOutcome != null,
        listener: (context, state) {
          final outcome = state.lastOutcome!;
          if (outcome.isSuccess) {
            final msg = switch (outcome.kind) {
              VisitActionKind.confirm => l10n.appointmentConfirmSuccess,
              VisitActionKind.requestReschedule =>
                l10n.appointmentRescheduleSuccess,
            };
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(msg)),
            );
          } else {
            showFailureSnackBar(context, outcome.failure!);
          }
        },
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<MyVisitsCubit>().load(),
              );
            case DataStatus.empty:
              return EmptyState(
                icon: Icons.event_note_outlined,
                title: l10n.myRequestsEmptyTitle,
                message: l10n.myRequestsEmptyMessage,
              );
            case DataStatus.success:
              final items = state.data!;
              return RefreshIndicator(
                onRefresh: () => context.read<MyVisitsCubit>().load(),
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: items.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) => _RequestCard(
                    request: items[i],
                    busy: state.inFlightAppointmentId != null &&
                        items[i].latestAppointment?.id ==
                            state.inFlightAppointmentId,
                  ),
                ),
              );
          }
        },
      ),
    );
  }
}

/// One request card. Renders the customer's submitted info, the latest
/// appointment (if any), and confirm / request-reschedule buttons when the
/// appointment is awaiting the customer.
class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request, required this.busy});

  final VisitRequest request;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final appointment = request.latestAppointment;
    final mutedStyle =
        theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted);

    // The badge shows the **appointment** state when one exists (P2's
    // two-sided lifecycle), falling back to the legacy request status for
    // pre-scheduled rows. Same approach as the web customer portal.
    final badgeLabel = appointment != null
        ? appointment.status.customerLabel(l10n)
        : request.status.label(l10n);
    final badgeTone = appointment != null
        ? appointment.status.tone
        : request.status.tone;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  request.projectName?.resolve(lang) ?? l10n.visitRequestTitle,
                  style: theme.textTheme.titleMedium,
                ),
              ),
              StatusBadge(label: badgeLabel, tone: badgeTone),
            ],
          ),
          if (request.preferredDate != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.visitOn(DateFormatter.mediumDate(
                  request.preferredDate!,
                  languageCode: lang)),
              style: mutedStyle,
            ),
          ],
          if (request.preferredTime != null &&
              request.preferredTime!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xxs),
            Text('${l10n.preferredTimeLabel}: ${request.preferredTime}',
                style: mutedStyle),
          ],
          if (appointment?.scheduledAt != null) ...[
            const SizedBox(height: AppSpacing.xxs),
            Text(
              '${l10n.appointmentProposedDateLabel}: '
              '${DateFormatter.mediumDate(appointment!.scheduledAt!, languageCode: lang)}',
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: colors.inkStrong),
            ),
          ],
          if (request.assignedSalesName != null) ...[
            const SizedBox(height: AppSpacing.xxs),
            Text(request.assignedSalesName!, style: mutedStyle),
          ],
          if (request.notes != null && request.notes!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text('${l10n.customerMessageLabel}:', style: mutedStyle),
            Text(request.notes!, style: theme.textTheme.bodyMedium),
          ],
          if (appointment?.status == AppointmentStatus.pendingReschedule &&
              appointment?.customerFeedback != null &&
              appointment!.customerFeedback!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text('${l10n.customerRescheduleReasonLabel}:', style: mutedStyle),
            Text(appointment.customerFeedback!,
                style: theme.textTheme.bodyMedium),
          ],
          if (appointment != null && appointment.awaitsCustomer) ...[
            const SizedBox(height: AppSpacing.md),
            _AppointmentActions(appointment: appointment, busy: busy),
          ],
        ],
      ),
    );
  }
}

/// Confirm / Request reschedule buttons for a single appointment. The
/// reschedule button opens a dialog that lets the customer attach an optional
/// reason; both calls are dispatched to [MyVisitsCubit].
class _AppointmentActions extends StatelessWidget {
  const _AppointmentActions({required this.appointment, required this.busy});

  final AppointmentSummary appointment;
  final bool busy;

  Future<void> _onRequestReschedule(BuildContext context) async {
    final cubit = context.read<MyVisitsCubit>();
    final reason = await _askReason(context);
    if (reason == null) return;
    await cubit.requestReschedule(appointment.id,
        reason: reason.isEmpty ? null : reason);
  }

  Future<String?> _askReason(BuildContext context) async {
    final l10n = context.l10n;
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.appointmentRescheduleReasonLabel),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          maxLength: 500,
          decoration:
              InputDecoration(hintText: l10n.appointmentRescheduleReasonHint),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(l10n.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: Text(l10n.appointmentSendReschedule),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        AppButton(
          label: l10n.appointmentActionConfirm,
          variant: AppButtonVariant.gold,
          size: AppButtonSize.medium,
          isLoading: busy,
          onPressed: busy
              ? null
              : () =>
                  context.read<MyVisitsCubit>().confirmAppointment(appointment.id),
        ),
        AppButton(
          label: l10n.appointmentActionRequestReschedule,
          variant: AppButtonVariant.outline,
          size: AppButtonSize.medium,
          onPressed: busy ? null : () => _onRequestReschedule(context),
        ),
      ],
    );
  }
}
