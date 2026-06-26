import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/lead.dart';
import '../cubit/leads_cubit.dart';

// Navy palette — same constants as AppNavHeader / _DashboardHeader.
const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);
const _navyLight = Color(0xFF243F62);

/// Leads list with search, stage filter pills, and a "my leads" toggle.
class LeadsScreen extends StatefulWidget {
  const LeadsScreen({super.key});

  @override
  State<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends State<LeadsScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<LeadsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<LeadsCubit>();
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      body: Column(
        children: [
          // ── Header: title+subtitle on the RIGHT, toggle on the LEFT (RTL) ──
          // Uses a single Row so the action is visually anchored to the title
          // block. AppNavHeader's separate actions-row disconnects them in RTL.
          BlocBuilder<LeadsCubit, LeadsListState>(
            buildWhen: (a, b) => a.mine != b.mine,
            builder: (context, state) => _LeadsHeader(
              l10n: l10n,
              mineActive: state.mine,
              onToggleMine: cubit.toggleMine,
            ),
          ),
          // ── Search ──────────────────────────────────────────────────────────
          _SearchBar(
            controller: _search,
            hint: l10n.leadsSearchHint,
            onSubmitted: cubit.setSearch,
          ),
          // ── Stage filter pills ───────────────────────────────────────────────
          BlocBuilder<LeadsCubit, LeadsListState>(
            buildWhen: (a, b) => a.stage != b.stage,
            builder: (context, state) => AppFilterPills<String>(
              allLabel: l10n.leadsFilterAll,
              selected: state.stage,
              onSelected: cubit.setStage,
              options: kLeadStages
                  .map(
                    (s) => FilterPillOption(
                      value: s,
                      label: leadStageLabel(l10n, s),
                      tone: leadStageTone(s),
                    ),
                  )
                  .toList(),
            ),
          ),
          // ── List ─────────────────────────────────────────────────────────────
          Expanded(
            child: BlocBuilder<LeadsCubit, LeadsListState>(
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
                      icon: Icons.people_outline_rounded,
                      title: l10n.leadsEmptyTitle,
                      message: l10n.leadsEmptyMessage,
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          AppSpacing.xs,
                          AppSpacing.md,
                          bottomPad + 80,
                        ),
                        itemCount: state.leads.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) =>
                            _LeadTile(lead: state.leads[i]),
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

// ── Custom leads header ───────────────────────────────────────────────────────
// Single-Row layout: [Expanded(title+subtitle), toggle] so the action is
// always visually aligned with the title block.
// In RTL: title block on the RIGHT, toggle button on the LEFT.
class _LeadsHeader extends StatelessWidget {
  const _LeadsHeader({
    required this.l10n,
    required this.mineActive,
    required this.onToggleMine,
  });

  final AppLocalizations l10n;
  final bool mineActive;
  final VoidCallback onToggleMine;

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.of(context).padding.top;
    final theme = Theme.of(context);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_navyLight, _navyMid, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(AppRadii.xl + 4),
            bottomRight: Radius.circular(AppRadii.xl + 4),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x33000000),
              blurRadius: 22,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            // Gold radial bloom — trailing corner
            PositionedDirectional(
              top: 0,
              end: -30,
              child: Container(
                width: 180,
                height: 180,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x1EC8A24B), Color(0x00C8A24B)],
                  ),
                ),
              ),
            ),
            // Gold shimmer hairline at bottom edge
            Positioned(
              bottom: 0,
              left: 40,
              right: 40,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      AppPalette.gold400.withValues(alpha: 0.50),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            // Content: title + toggle in ONE row (no separate actions row)
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.md,
                topPad + AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Title + subtitle — in RTL this Expanded sits on the RIGHT.
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.navLeads,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          l10n.leadsSubtitle,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.65),
                            fontSize: 13,
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  // "My leads" toggle — in RTL this sits on the LEFT side.
                  NavHeaderAction(
                    icon: mineActive
                        ? Icons.person_rounded
                        : Icons.person_outline_rounded,
                    tooltip: l10n.leadsMine,
                    onTap: onToggleMine,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Lead card ─────────────────────────────────────────────────────────────────
// Date is intentionally excluded from the list view — it clutters the card.
// It remains on the Lead domain entity and is shown on the detail screen.
class _LeadTile extends StatelessWidget {
  const _LeadTile({required this.lead});
  final Lead lead;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final initials =
        lead.fullName.isNotEmpty ? lead.fullName.characters.first : '?';

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      onTap: () => context.push('/leads/${lead.id}', extra: lead),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Avatar
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: colors.brandGoldSoft,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              initials,
              style: TextStyle(
                color: colors.brandGold,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          // Name + project interest
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  lead.fullName,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: colors.inkStrong,
                    height: 1.25,
                  ),
                ),
                if (lead.projectInterest != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        Icons.apartment_outlined,
                        size: 13,
                        color: colors.inkMuted,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          lead.projectInterest!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            color: colors.inkMuted,
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          // Stage badge + optional call icon
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              StatusBadge(
                label: leadStageLabel(l10n, lead.stage),
                tone: leadStageTone(lead.stage),
              ),
              if (lead.phone != null) ...[
                const SizedBox(height: AppSpacing.xs),
                _ActionIcon(
                  icon: Icons.call_rounded,
                  tooltip: l10n.callClient,
                  color: colors.success,
                  onTap: () => ContactActions.call(lead.phone!),
                ),
              ],
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
