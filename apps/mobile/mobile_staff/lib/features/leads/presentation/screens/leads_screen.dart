import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/lead.dart';
import '../cubit/leads_cubit.dart';

const _navyDeep  = Color(0xFF0B1726);
const _navyMid   = Color(0xFF14273F);
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
    final l10n   = context.l10n;
    final cubit  = context.read<LeadsCubit>();
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      body: Column(
        children: [
          // ── Header ────────────────────────────────────────────────────
          BlocBuilder<LeadsCubit, LeadsListState>(
            buildWhen: (a, b) => a.mine != b.mine,
            builder: (context, state) => _LeadsHeader(
              l10n: l10n,
              mineActive: state.mine,
              onToggleMine: cubit.toggleMine,
            ),
          ),

          // ── Search ────────────────────────────────────────────────────
          _SearchBar(
            controller: _search,
            hint: l10n.leadsSearchHint,
            onSubmitted: cubit.setSearch,
          ),

          // ── Stage filter (6 pills, no "All" — tap active to deselect) ─
          BlocBuilder<LeadsCubit, LeadsListState>(
            buildWhen: (a, b) => a.stage != b.stage,
            builder: (context, state) => AppFilterPills<String>(
              selected: state.stage,
              onSelected: (s) {
                // Toggle-off: tapping the active stage clears the filter.
                cubit.setStage(s == state.stage ? null : s);
              },
              options: kLeadStages
                  .map((s) => FilterPillOption(
                        value: s,
                        label: leadStageLabel(l10n, s),
                        tone: leadStageTone(s),
                      ))
                  .toList(),
            ),
          ),

          // ── Lead list ─────────────────────────────────────────────────
          Expanded(
            child: BlocBuilder<LeadsCubit, LeadsListState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
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
                            AppSpacing.md, AppSpacing.xs,
                            AppSpacing.md, bottomPad + 80),
                        itemCount: state.leads.length,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) => _LeadTile(lead: state.leads[i]),
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

// ── Header ────────────────────────────────────────────────────────────────────

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
    final theme  = Theme.of(context);

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
            BoxShadow(color: Color(0x33000000), blurRadius: 22, offset: Offset(0, 8)),
          ],
        ),
        child: Stack(
          children: [
            PositionedDirectional(
              top: 0, end: -30,
              child: Container(
                width: 180, height: 180,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x1EC8A24B), Color(0x00C8A24B)],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 0, left: 40, right: 40,
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
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.md, topPad + AppSpacing.sm,
                AppSpacing.md, AppSpacing.sm,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
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
                            fontSize: 13, height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  NavHeaderAction(
                    icon: mineActive ? Icons.person_rounded : Icons.person_outline_rounded,
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

// ── Lead tile card ────────────────────────────────────────────────────────────

class _LeadTile extends StatelessWidget {
  const _LeadTile({required this.lead});
  final Lead lead;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final initial = lead.fullName.isNotEmpty ? lead.fullName.characters.first : '?';
    final tone    = leadStageTone(lead.stage);
    final stageColor = _toneColor(colors, tone);

    return GestureDetector(
      onTap: () => context.push('/leads/${lead.id}', extra: lead),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.hairline),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8, offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Leading accent bar
              Container(
                width: 4,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [stageColor, stageColor.withValues(alpha: 0.45)],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),

              // Card content
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 12),
                  child: Row(
                    children: [
                      // Avatar
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: colors.brandGoldSoft,
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          initial,
                          style: TextStyle(
                            color: colors.brandGold,
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),

                      // Name + project
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              lead.fullName,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: colors.inkStrong,
                                height: 1.25,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (lead.projectInterest != null) ...[
                              const SizedBox(height: 3),
                              Row(
                                children: [
                                  Icon(Icons.apartment_outlined,
                                      size: 12, color: colors.inkMuted),
                                  const SizedBox(width: 3),
                                  Expanded(
                                    child: Text(
                                      lead.projectInterest!,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: colors.inkMuted,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),

                      // Stage badge + phone action
                      Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: stageColor.withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: stageColor.withValues(alpha: 0.24),
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
                          if (lead.phone != null) ...[
                            const SizedBox(height: 8),
                            GestureDetector(
                              onTap: () => ContactActions.call(lead.phone!),
                              child: Container(
                                width: 30, height: 30,
                                decoration: BoxDecoration(
                                  color: colors.success.withValues(alpha: 0.10),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.call_rounded,
                                  size: 15,
                                  color: colors.success,
                                ),
                              ),
                            ),
                          ],
                        ],
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

  Color _toneColor(AppColorsExt c, BadgeTone tone) => switch (tone) {
        BadgeTone.success => c.success,
        BadgeTone.warning => c.warning,
        BadgeTone.error   => c.error,
        BadgeTone.info    => c.info,
        BadgeTone.gold    => c.brandGold,
        _                 => c.inkMuted,
      };
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
          AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.xs),
      child: TextField(
        controller: controller,
        textInputAction: TextInputAction.search,
        onSubmitted: onSubmitted,
        style: TextStyle(fontSize: 15, color: colors.inkStrong),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(fontSize: 15, color: colors.inkMuted),
          prefixIcon: Icon(Icons.search_rounded, size: 20, color: colors.inkMuted),
          contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md, vertical: 12),
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
