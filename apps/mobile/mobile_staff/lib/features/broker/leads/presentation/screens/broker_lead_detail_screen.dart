import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/broker_status_label.dart';
import '../../../../../common/lead_stage_label.dart';
import '../../../../../common/staff_contact_actions.dart';
import '../../domain/entities/broker_lead.dart';
import '../cubit/broker_lead_detail_cubit.dart';

/// Broker lead detail: contact, status, create-reservation CTA, and timeline.
class BrokerLeadDetailScreen extends StatefulWidget {
  const BrokerLeadDetailScreen({super.key, this.fallback});
  final BrokerLead? fallback;

  @override
  State<BrokerLeadDetailScreen> createState() => _BrokerLeadDetailScreenState();
}

class _BrokerLeadDetailScreenState extends State<BrokerLeadDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerLeadDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(widget.fallback?.fullName ?? l10n.navLeads)),
      body: BlocBuilder<BrokerLeadDetailCubit, BrokerLeadDetailState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(failure: state.failure, onRetry: () => context.read<BrokerLeadDetailCubit>().load());
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
  final BrokerLeadDetail detail;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final lead = detail.lead;

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
                  Expanded(child: Text(lead.fullName, style: Theme.of(context).textTheme.titleLarge)),
                  StatusBadge(
                    label: brokerLeadStatusLabel(l10n, lead.approvalStatus),
                    tone: brokerLeadStatusTone(lead.approvalStatus),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Row(
                children: [
                  StatusBadge(label: leadStageLabel(l10n, lead.stage), tone: leadStageTone(lead.stage)),
                  if (lead.projectName != null) ...[
                    const SizedBox(width: AppSpacing.sm),
                    Flexible(
                      child: Text(lead.projectName!,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              StaffContactButtons(phone: lead.phone),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AppButton(
          label: l10n.reservationNew,
          icon: Icons.bookmark_add_outlined,
          variant: AppButtonVariant.outline,
          expand: true,
          onPressed: () => context.push('/broker/reservations/new', extra: {'leadId': lead.id}),
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
                        Text(e.body, style: Theme.of(context).textTheme.bodyMedium),
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
