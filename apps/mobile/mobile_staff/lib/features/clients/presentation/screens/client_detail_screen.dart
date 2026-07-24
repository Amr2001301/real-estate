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
            _LeadCard(lead: lead, lang: lang),
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

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0].characters.first}${parts[1].characters.first}';
    }
    return parts[0].characters.first;
  }

  Color _toneColor(AppColorsExt c, BadgeTone tone) => switch (tone) {
        BadgeTone.success => c.success,
        BadgeTone.warning => c.warning,
        BadgeTone.error   => c.error,
        BadgeTone.info    => c.info,
        BadgeTone.gold    => c.brandGold,
        _                 => c.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);
    final tone   = leadStageTone(client.latestStage);
    final stageColor = _toneColor(colors, tone);
    final initials = client.fullName.isNotEmpty ? _initials(client.fullName) : '?';

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Top: avatar + info ──────────────────────────────────────
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar with gold ring + glow
                Container(
                  width: 56, height: 56,
                  decoration: BoxDecoration(
                    color: colors.brandGoldSoft,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: colors.brandGold.withValues(alpha: 0.35),
                      width: 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: colors.brandGold.withValues(alpha: 0.15),
                        blurRadius: 8,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    initials,
                    style: TextStyle(
                      color: colors.brandGold,
                      fontSize: initials.length > 1 ? 18 : 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 12),

                // Name + stage badge + meta
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              client.fullName,
                              style: theme.textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                                height: 1.2,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Stage badge
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: stageColor.withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: stageColor.withValues(alpha: 0.25),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 5, height: 5,
                                  decoration: BoxDecoration(
                                    color: stageColor, shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  leadStageLabel(l10n, client.latestStage),
                                  style: TextStyle(
                                    color: stageColor,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),

                      // Lead count chip
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: colors.surfaceSoft,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.folder_open_outlined,
                                size: 12, color: colors.inkMuted),
                            const SizedBox(width: 4),
                            Text(
                              l10n.clientsLeadCount(client.leadCount),
                              style: TextStyle(
                                color: colors.inkMuted,
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),

                      if (client.email != null) ...[
                        const SizedBox(height: 6),
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

          // ── Contact buttons ─────────────────────────────────────────
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

// ── Lead card ─────────────────────────────────────────────────────────────────

class _LeadCard extends StatelessWidget {
  const _LeadCard({required this.lead, required this.lang});
  final ClientLeadRef lead;
  final String lang;

  Color _toneColor(AppColorsExt c, BadgeTone tone) => switch (tone) {
        BadgeTone.success => c.success,
        BadgeTone.warning => c.warning,
        BadgeTone.error   => c.error,
        BadgeTone.info    => c.info,
        BadgeTone.gold    => c.brandGold,
        _                 => c.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);
    final tone   = leadStageTone(lead.stage);
    final stageColor = _toneColor(colors, tone);
    final isRtl = Directionality.of(context) == TextDirection.rtl;

    return GestureDetector(
      onTap: () => context.push('/leads/${lead.leadId}'),
      behavior: HitTestBehavior.opaque,
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.hairline),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Stage-colored left accent bar
              Container(
                width: 4,
                decoration: BoxDecoration(
                  color: stageColor,
                  borderRadius: isRtl
                      ? const BorderRadius.only(
                          topRight: Radius.circular(16),
                          bottomRight: Radius.circular(16),
                        )
                      : const BorderRadius.only(
                          topLeft: Radius.circular(16),
                          bottomLeft: Radius.circular(16),
                        ),
                ),
              ),

              // Content
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              lead.projectInterest ?? l10n.navLeads,
                              style: theme.textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            if (lead.createdAt != null) ...[
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Icon(Icons.calendar_today_outlined,
                                      size: 11, color: colors.inkMuted),
                                  const SizedBox(width: 4),
                                  Text(
                                    DateFormatter.shortDate(
                                        lead.createdAt!,
                                        languageCode: lang),
                                    style: theme.textTheme.labelSmall
                                        ?.copyWith(color: colors.inkMuted),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),

                      // Stage badge pill
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: stageColor.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: stageColor.withValues(alpha: 0.25),
                          ),
                        ),
                        child: Text(
                          leadStageLabel(l10n, lead.stage),
                          style: TextStyle(
                            color: stageColor,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        isRtl
                            ? Icons.chevron_left_rounded
                            : Icons.chevron_right_rounded,
                        color: colors.inkMuted,
                        size: 18,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
