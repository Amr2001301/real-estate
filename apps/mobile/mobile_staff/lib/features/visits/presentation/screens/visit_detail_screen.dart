import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../common/staff_contact_actions.dart';
import '../../../../common/visit_status_label.dart';
import '../../domain/entities/visit.dart';
import '../cubit/visit_detail_cubit.dart';

/// Visit detail: summary, contact, status transitions, and activity timeline.
class VisitDetailScreen extends StatefulWidget {
  const VisitDetailScreen({super.key, this.fallback});
  final Visit? fallback;

  @override
  State<VisitDetailScreen> createState() => _VisitDetailScreenState();
}

class _VisitDetailScreenState extends State<VisitDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<VisitDetailCubit>().load();
  }

  /// True when the visit carries anything the customer originally asked for —
  /// gates rendering the "ما طلبه العميل" panel so it doesn't appear as an
  /// empty card on walk-in / sales-created visits.
  bool _hasCustomerRequestContext(Visit visit) =>
      visit.requestPreferredDate != null ||
      (visit.requestPreferredTime?.isNotEmpty ?? false) ||
      (visit.requestNotes?.isNotEmpty ?? false);

  Future<void> _apply(VisitTransition t) async {
    final cubit = context.read<VisitDetailCubit>();
    // Cancel / no-show optionally capture a reason.
    if (t == VisitTransition.cancel || t == VisitTransition.noShow) {
      final reason = await _askReason();
      if (reason == null) return; // dismissed
      await cubit.apply(t, reason: reason.isEmpty ? null : reason);
    } else {
      await cubit.apply(t);
    }
  }

  Future<String?> _askReason() async {
    final l10n = context.l10n;
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.visitReasonTitle),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(hintText: l10n.visitReasonHint),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l10n.actionCancel)),
          TextButton(onPressed: () => Navigator.pop(ctx, controller.text), child: Text(l10n.actionContinue)),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  String _label(AppLocalizations l10n, VisitTransition t) => switch (t) {
        VisitTransition.confirm => l10n.visitActionConfirm,
        VisitTransition.complete => l10n.visitActionComplete,
        VisitTransition.cancel => l10n.visitActionCancel,
        VisitTransition.noShow => l10n.visitActionNoShow,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(widget.fallback?.clientName ?? l10n.navVisits)),
      body: BlocConsumer<VisitDetailCubit, VisitDetailState>(
        listenWhen: (a, b) => a.actionFailure != b.actionFailure && b.actionFailure != null,
        listener: (context, state) => showFailureSnackBar(context, state.actionFailure!),
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(failure: state.failure, onRetry: () => context.read<VisitDetailCubit>().load());
            case DataStatus.empty:
            case DataStatus.success:
              return _body(context, state);
          }
        },
      ),
    );
  }

  Widget _body(BuildContext context, VisitDetailState state) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final detail = state.detail!;
    final v = detail.visit;
    final allowed = allowedVisitTransitions(v);

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
                    child: Text(v.clientName ?? l10n.navVisits,
                        style: Theme.of(context).textTheme.titleLarge),
                  ),
                  StatusBadge(label: visitStatusLabel(l10n, v.status), tone: visitStatusTone(v.status)),
                ],
              ),
              if (v.scheduledAt != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(DateFormatter.mediumDate(v.scheduledAt!, languageCode: lang),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.inkMuted)),
              ],
              if (v.projectName != null) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text('${v.projectName}${v.unitCode != null ? ' · ${v.unitCode}' : ''}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
              if (v.location != null && v.location!.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text('${l10n.visitLocation}: ${v.location}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
              const SizedBox(height: AppSpacing.md),
              StaffContactButtons(phone: v.clientPhone),
            ],
          ),
        ),
        if (_hasCustomerRequestContext(v)) ...[
          const SizedBox(height: AppSpacing.md),
          AppCard(
            elevation: AppCardElevation.soft,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.customerMessageLabel,
                    style: Theme.of(context).textTheme.titleSmall),
                if (v.requestPreferredDate != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.visitOn(DateFormatter.mediumDate(
                        v.requestPreferredDate!,
                        languageCode: lang)),
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
                if (v.requestPreferredTime != null &&
                    v.requestPreferredTime!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    '${l10n.preferredTimeLabel}: ${v.requestPreferredTime}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.inkMuted),
                  ),
                ],
                if (v.requestNotes != null && v.requestNotes!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(v.requestNotes!,
                      style: Theme.of(context).textTheme.bodyMedium),
                ],
              ],
            ),
          ),
        ],
        if (v.status == 'PENDING_RESCHEDULE' &&
            v.customerFeedback != null &&
            v.customerFeedback!.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          AppCard(
            elevation: AppCardElevation.soft,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.customerRescheduleReasonLabel,
                    style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: AppSpacing.xs),
                Text(v.customerFeedback!,
                    style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ],
        if (allowed.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text(l10n.visitUpdateStatus, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final t in allowed)
                AppButton(
                  label: _label(l10n, t),
                  size: AppButtonSize.medium,
                  variant: t == VisitTransition.complete || t == VisitTransition.confirm
                      ? AppButtonVariant.gold
                      : AppButtonVariant.outline,
                  onPressed: state.working ? null : () => _apply(t),
                ),
            ],
          ),
        ],
        if (detail.salesNotes != null && detail.salesNotes!.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          Text(l10n.visitNotes, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          Text(detail.salesNotes!, style: Theme.of(context).textTheme.bodyMedium),
        ],
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
                  Icon(Icons.history_rounded, size: 18, color: colors.inkMuted),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(e.note ?? e.type, style: Theme.of(context).textTheme.bodyMedium),
                        if (e.createdAt != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            [
                              if (e.actorName != null) e.actorName!,
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
