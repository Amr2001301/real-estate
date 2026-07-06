import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_contact_actions.dart';
import '../../domain/entities/staff_client.dart';
import '../cubit/client_detail_cubit.dart';

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
    final l10n  = context.l10n;
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: widget.fallback?.fullName ?? l10n.navClients,
            leadingAction: NavHeaderAction(
              icon: isRtl
                  ? Icons.arrow_forward_ios_rounded
                  : Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          Expanded(
            child: BlocBuilder<ClientDetailCubit, ClientDetailState>(
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
          ),
        ],
      ),
    );
  }
}

// ── Body ──────────────────────────────────────────────────────────────────────

class _Body extends StatelessWidget {
  const _Body({required this.detail});
  final ClientDetail detail;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xl),
      children: [
        _ClientCard(client: detail.client),
        const SizedBox(height: AppSpacing.lg),
        _SectionHeader(label: l10n.clientLeads),
        const SizedBox(height: AppSpacing.sm),
        if (detail.leads.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.lg),
            child: EmptyState(
              icon: Icons.person_search_outlined,
              title: l10n.clientLeads,
            ),
          )
        else
          for (final lead in detail.leads) ...[
            _LeadTile(lead: lead, lang: lang),
            const SizedBox(height: AppSpacing.sm),
          ],
      ],
    );
  }
}

// ── Client info card ──────────────────────────────────────────────────────────

class _ClientCard extends StatelessWidget {
  const _ClientCard({required this.client});
  final StaffClient client;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme  = Theme.of(context);
    final initials = client.fullName.isNotEmpty
        ? client.fullName.characters.first
        : '?';

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar circle with gold border
                Container(
                  width: 54, height: 54,
                  decoration: BoxDecoration(
                    color: colors.brandGoldSoft,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: colors.brandGold.withValues(alpha: 0.30),
                      width: 2,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    initials,
                    style: TextStyle(
                      color: colors.brandGold,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // Name + contact meta
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        client.fullName,
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          height: 1.2,
                        ),
                      ),
                      if (client.email != null) ...[
                        const SizedBox(height: 5),
                        Row(children: [
                          Icon(Icons.email_outlined,
                              size: 13, color: colors.inkMuted),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              client.email!,
                              style: theme.textTheme.bodySmall
                                  ?.copyWith(color: colors.inkMuted),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ]),
                      ],
                      if (client.phone != null) ...[
                        const SizedBox(height: 3),
                        Row(children: [
                          Icon(Icons.phone_outlined,
                              size: 13, color: colors.inkMuted),
                          const SizedBox(width: 4),
                          Text(
                            client.phone!,
                            style: theme.textTheme.bodySmall
                                ?.copyWith(color: colors.inkMuted),
                          ),
                        ]),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: colors.hairline),
          Padding(
            padding: const EdgeInsets.all(12),
            child: StaffContactButtons(phone: client.phone),
          ),
        ],
      ),
    );
  }
}

// ── Section header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 3, height: 16,
            decoration: BoxDecoration(
              color: AppPalette.gold400,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      );
}

// ── Lead tile ─────────────────────────────────────────────────────────────────

class _LeadTile extends StatelessWidget {
  const _LeadTile({required this.lead, required this.lang});
  final ClientLeadRef lead;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;

    return GestureDetector(
      onTap: () => context.push('/leads/${lead.leadId}'),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.hairline),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lead.projectInterest ?? l10n.navLeads,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (lead.createdAt != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      DateFormatter.shortDate(
                          lead.createdAt!, languageCode: lang),
                      style: Theme.of(context).textTheme.labelSmall
                          ?.copyWith(color: colors.inkMuted),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            StatusBadge(
              label: leadStageLabel(l10n, lead.stage),
              tone: leadStageTone(lead.stage),
            ),
            const SizedBox(width: 4),
            Icon(
              Directionality.of(context) == TextDirection.rtl
                  ? Icons.chevron_left_rounded
                  : Icons.chevron_right_rounded,
              color: colors.inkMuted,
              size: 18,
            ),
          ],
        ),
      ),
    );
  }
}
