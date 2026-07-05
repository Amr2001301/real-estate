import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_contact_actions.dart';
import '../../domain/entities/staff_client.dart';
import '../cubit/client_detail_cubit.dart';

/// Client detail: contact actions + the client's leads (each links to the lead
/// detail, which carries the full notes/activities timeline).
class ClientDetailScreen extends StatefulWidget {
  const ClientDetailScreen({super.key, this.fallback});
  final StaffClient? fallback;

  @override
  State<ClientDetailScreen> createState() => _ClientDetailScreenState();
}

class _ClientDetailScreenState extends State<ClientDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ClientDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(widget.fallback?.fullName ?? l10n.navClients)),
      body: BlocBuilder<ClientDetailCubit, ClientDetailState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<ClientDetailCubit>().load(),
              );
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
  final ClientDetail detail;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final c = detail.client;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        AppCard(
          elevation: AppCardElevation.soft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(c.fullName, style: Theme.of(context).textTheme.titleLarge),
              if (c.email != null) ...[
                const SizedBox(height: 2),
                Text(c.email!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
              if (c.phone != null) ...[
                const SizedBox(height: 2),
                Text(c.phone!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
              const SizedBox(height: AppSpacing.md),
              StaffContactButtons(phone: c.phone),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(l10n.clientLeads, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        for (final lead in detail.leads) ...[
          AppCard(
            onTap: () => context.push('/leads/${lead.leadId}'),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(lead.projectInterest ?? l10n.navLeads,
                          style: Theme.of(context).textTheme.titleSmall),
                      if (lead.createdAt != null) ...[
                        const SizedBox(height: 2),
                        Text(DateFormatter.shortDate(lead.createdAt!, languageCode: lang),
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.inkMuted)),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                StatusBadge(label: leadStageLabel(l10n, lead.stage), tone: leadStageTone(lead.stage)),
                Icon(
                  Directionality.of(context) == TextDirection.rtl
                      ? Icons.chevron_left_rounded
                      : Icons.chevron_right_rounded,
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
