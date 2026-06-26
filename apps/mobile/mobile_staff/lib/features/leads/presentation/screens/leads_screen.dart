import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/lead.dart';
import '../cubit/leads_cubit.dart';

/// Leads list with search, stage filter chips, and a "my leads" toggle.
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
          // Premium header — "my leads" toggle is a glass action button
          BlocBuilder<LeadsCubit, LeadsListState>(
            buildWhen: (a, b) => a.mine != b.mine,
            builder: (context, state) => AppNavHeader(
              title: l10n.navLeads,
              subtitle: l10n.leadsSubtitle,
              actions: [
                NavHeaderAction(
                  icon: state.mine
                      ? Icons.person_rounded
                      : Icons.person_outline_rounded,
                  tooltip: l10n.leadsMine,
                  onTap: cubit.toggleMine,
                ),
              ],
            ),
          ),
          // Search
          _SearchBar(
            controller: _search,
            hint: l10n.leadsSearchHint,
            onSubmitted: cubit.setSearch,
          ),
          // Stage filter chips — RTL-safe horizontal scroll via Row
          _StageFilter(),
          // List
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

// ── Stage filter chips ────────────────────────────────────────────────────────
// Uses SingleChildScrollView > Row so RTL layout is correct:
// in RTL, Row renders first child at the RIGHT, which is the "الكل" chip —
// exactly where the leading filter should appear.
class _StageFilter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<LeadsCubit>();
    final colors = context.appColors;

    return BlocBuilder<LeadsCubit, LeadsListState>(
      buildWhen: (a, b) => a.stage != b.stage,
      builder: (context, state) {
        return SizedBox(
          height: 46,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            // DirectionalityAware padding so leading edge has full indent
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              4,
              AppSpacing.md,
              4,
            ),
            child: Row(
              children: [
                _FilterChip(
                  label: l10n.leadsFilterAll,
                  selected: state.stage == null,
                  colors: colors,
                  onTap: () => cubit.setStage(null),
                ),
                const SizedBox(width: AppSpacing.xs),
                for (final stage in kLeadStages) ...[
                  _FilterChip(
                    label: leadStageLabel(l10n, stage),
                    selected: state.stage == stage,
                    colors: colors,
                    onTap: () => cubit.setStage(stage),
                    tone: leadStageTone(stage),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.colors,
    required this.onTap,
    this.tone,
  });
  final String label;
  final bool selected;
  final AppColorsExt colors;
  final VoidCallback onTap;
  final BadgeTone? tone;

  Color get _selectedBg => switch (tone) {
    BadgeTone.gold => colors.brandGold,
    BadgeTone.success => colors.success,
    BadgeTone.warning => colors.warning,
    BadgeTone.error => colors.error,
    BadgeTone.info => colors.info,
    _ => colors.brandGold,
  };

  @override
  Widget build(BuildContext context) {
    final bg = selected ? _selectedBg : colors.surface;
    final fg = selected ? Colors.white : colors.inkStrong;
    final border = selected ? _selectedBg : colors.hairline;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(color: border),
          borderRadius: BorderRadius.circular(AppRadii.pill),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: _selectedBg.withValues(alpha: 0.25),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
            color: fg,
            height: 1.2,
          ),
        ),
      ),
    );
  }
}

// ── Lead card ─────────────────────────────────────────────────────────────────
class _LeadTile extends StatelessWidget {
  const _LeadTile({required this.lead});
  final Lead lead;

  static String _shortDate(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt).inDays;
    if (diff == 0) return 'اليوم';
    if (diff == 1) return 'أمس';
    if (diff < 7) return '$diff أيام';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

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
          // Name + project + date
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
                  const SizedBox(height: 3),
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
                if (lead.createdAt != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    _shortDate(lead.createdAt!),
                    style: TextStyle(
                      fontSize: 12,
                      color: colors.inkMuted,
                      height: 1.3,
                    ),
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

// ── Shared search bar ─────────────────────────────────────────────────────────
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

// ── Tiny icon action ──────────────────────────────────────────────────────────
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
