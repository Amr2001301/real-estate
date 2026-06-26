import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/staff_client.dart';
import '../cubit/clients_cubit.dart';

/// Clients list — the rep's distinct contacts, derived from their lead book.
class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<ClientsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ClientsCubit>();
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      body: Column(
        children: [
          // Clients has no action in the header — AppNavHeader works correctly
          // here (no separate actions row is rendered when actions is empty).
          AppNavHeader(
            title: l10n.navClients,
            subtitle: l10n.clientsSubtitle,
          ),
          _SearchBar(
            controller: _search,
            hint: l10n.clientsSearchHint,
            onSubmitted: cubit.setSearch,
          ),
          Expanded(
            child: BlocBuilder<ClientsCubit, ClientsListState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: cubit.load,
                    );
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.contacts_outlined,
                      title: l10n.clientsEmptyTitle,
                      message: l10n.clientsEmptyMessage,
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          AppSpacing.sm,
                          AppSpacing.md,
                          bottomPad + 80,
                        ),
                        itemCount: state.clients.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) =>
                            _ClientTile(client: state.clients[i]),
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

// ── Client card ───────────────────────────────────────────────────────────────
// Layout:
//   Row 1: [avatar] [name + phone?] [stage badge]
//   Row 2:          [opportunity count]    [call button if phone]
// This separates identity/status (row 1) from metadata/actions (row 2) and
// avoids stacking the call button below the badge in a disconnected column.
class _ClientTile extends StatelessWidget {
  const _ClientTile({required this.client});
  final StaffClient client;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final initials =
        client.fullName.isNotEmpty ? client.fullName.characters.first : '?';

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      onTap: () => context.push('/clients/${client.clientId}', extra: client),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Row 1: avatar + name + stage badge ──────────────────────────────
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Avatar
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: colors.brandGoldSoft,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  initials,
                  style: TextStyle(
                    color: colors.brandGold,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              // Name (+ optional phone)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      client.fullName,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: colors.inkStrong,
                        height: 1.25,
                      ),
                    ),
                    if (client.phone != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        client.phone!,
                        style: TextStyle(
                          fontSize: 13,
                          color: colors.inkMuted,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              // Stage badge
              StatusBadge(
                label: leadStageLabel(l10n, client.latestStage),
                tone: leadStageTone(client.latestStage),
              ),
            ],
          ),
          // ── Row 2: opportunity count + call button ───────────────────────────
          const SizedBox(height: 8),
          Row(
            children: [
              Text(
                l10n.salesOpportunityCount(client.leadCount),
                style: TextStyle(
                  fontSize: 12,
                  color: colors.inkMuted,
                  height: 1.3,
                ),
              ),
              const Spacer(),
              if (client.phone != null)
                _ActionIcon(
                  icon: Icons.call_rounded,
                  tooltip: l10n.callClient,
                  color: colors.success,
                  onTap: () => ContactActions.call(client.phone!),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Search bar ────────────────────────────────────────────────────────────────
class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.controller,
    required this.hint,
    required this.onSubmitted,
  });
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onSubmitted;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.xs,
      ),
      child: TextField(
        controller: controller,
        textInputAction: TextInputAction.search,
        onSubmitted: onSubmitted,
        style: TextStyle(fontSize: 15, color: colors.inkStrong),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(fontSize: 15, color: colors.inkMuted),
          prefixIcon: Icon(
            Icons.search_rounded,
            size: 20,
            color: colors.inkMuted,
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 12,
          ),
          isDense: true,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            borderSide: BorderSide(color: colors.hairline),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            borderSide: BorderSide(color: colors.hairline),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            borderSide: BorderSide(color: colors.brandGold, width: 1.5),
          ),
          filled: true,
          fillColor: colors.surface,
        ),
      ),
    );
  }
}

// ── Tiny circular action icon ─────────────────────────────────────────────────
class _ActionIcon extends StatelessWidget {
  const _ActionIcon({
    required this.icon,
    required this.tooltip,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String tooltip;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Tooltip(
        message: tooltip,
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.10),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 16, color: color),
        ),
      ),
    );
  }
}
