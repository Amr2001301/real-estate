import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/lead.dart';
import '../cubit/leads_cubit.dart';

// ── Helpers ────────────────────────────────────────────────────────────────────

Color _stageColor(String stage, AppColorsExt colors) => switch (stage) {
  'NEW'         => colors.inkMuted,
  'INTERESTED'  => colors.info,
  'VISIT'       => colors.brandGold,
  'NEGOTIATION' => colors.warning,
  'WON'         => colors.success,
  'LOST'        => colors.error,
  _             => colors.inkMuted,
};

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  final a = parts.first.characters.firstOrNull ?? '?';
  if (parts.length >= 2) {
    final b = parts.last.characters.firstOrNull ?? '';
    return '$a$b'.toUpperCase();
  }
  return a.toUpperCase();
}

// ── Screen ────────────────────────────────────────────────────────────────────

class LeadsScreen extends StatefulWidget {
  const LeadsScreen({super.key});

  @override
  State<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends State<LeadsScreen> {
  final _search = TextEditingController();
  final _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<LeadsCubit>().load();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _search.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 200) {
      context.read<LeadsCubit>().loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n      = context.l10n;
    final cubit     = context.read<LeadsCubit>();
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final lang      = Localizations.localeOf(context).languageCode;

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final created = await context.push<bool>('/leads/new');
          if (created == true && context.mounted) cubit.load();
        },
        tooltip: l10n.leadNew,
        child: const Icon(Icons.add_rounded),
      ),
      body: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────────────
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
          // ── Search ──────────────────────────────────────────────────────────
          _SearchBar(
            controller: _search,
            hint: l10n.leadsSearchHint,
            onSubmitted: cubit.setSearch,
          ),
          // ── Stage filter chips ───────────────────────────────────────────────
          BlocBuilder<LeadsCubit, LeadsListState>(
            buildWhen: (a, b) => a.stage != b.stage,
            builder: (context, state) => _StageFilterRow(
              selected: state.stage,
              lang: lang,
              onSelected: (s) => cubit.setStage(s == state.stage ? null : s),
            ),
          ),
          // ── Body ────────────────────────────────────────────────────────────
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
                      child: CustomScrollView(
                        controller: _scrollCtrl,
                        physics: const AlwaysScrollableScrollPhysics(),
                        slivers: [
                          SliverToBoxAdapter(
                            child: _KpiRow(leads: state.leads, lang: lang),
                          ),
                          SliverPadding(
                            padding: EdgeInsets.fromLTRB(
                              AppSpacing.md,
                              AppSpacing.xs,
                              AppSpacing.md,
                              AppSpacing.md,
                            ),
                            sliver: SliverList(
                              delegate: SliverChildBuilderDelegate(
                                (context, i) {
                                  if (i.isOdd) {
                                    return const SizedBox(height: AppSpacing.sm);
                                  }
                                  return _LeadCard(lead: state.leads[i ~/ 2]);
                                },
                                childCount: state.leads.length * 2 - 1,
                              ),
                            ),
                          ),
                          if (state.isLoadingMore)
                            const SliverToBoxAdapter(
                              child: Padding(
                                padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                                child: Center(child: CircularProgressIndicator()),
                              ),
                            ),
                          SliverPadding(
                            padding: EdgeInsets.only(bottom: bottomPad + 100),
                          ),
                        ],
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
        AppSpacing.md,
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
            borderSide: const BorderSide(color: AppPalette.gold400, width: 1.5),
          ),
          filled: true,
          fillColor: colors.surface,
        ),
      ),
    );
  }
}

// ── Stage filter row ──────────────────────────────────────────────────────────

class _StageFilterRow extends StatelessWidget {
  const _StageFilterRow({
    required this.selected,
    required this.lang,
    required this.onSelected,
  });
  final String? selected;
  final String lang;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SizedBox(
      height: 40,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 2,
        ),
        child: Row(
          children: [
            _FilterChip(
              label: lang == 'ar' ? 'الكل' : 'All',
              active: selected == null,
              onTap: () => onSelected(null),
            ),
            const SizedBox(width: AppSpacing.xs),
            for (final stage in kLeadStages) ...[
              _FilterChip(
                label: leadStageLabel(l10n, stage),
                active: selected == stage,
                onTap: () => onSelected(stage),
              ),
              if (stage != kLeadStages.last) const SizedBox(width: AppSpacing.xs),
            ],
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: 4,
        ),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          border: Border.all(
            color: active ? colors.brandNavy : colors.hairline,
          ),
          borderRadius: AppRadii.pillAll,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            color: active ? Colors.white : colors.inkStrong,
            height: 1.2,
          ),
        ),
      ),
    );
  }
}

// ── KPI summary row ───────────────────────────────────────────────────────────

class _KpiRow extends StatelessWidget {
  const _KpiRow({required this.leads, required this.lang});
  final List<Lead> leads;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors   = context.appColors;
    final total    = leads.length;
    final pipeline = leads
        .where(
          (l) =>
              l.stage == 'INTERESTED' ||
              l.stage == 'VISIT' ||
              l.stage == 'NEGOTIATION',
        )
        .length;
    final won = leads.where((l) => l.stage == 'WON').length;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.xs,
      ),
      child: Row(
        children: [
          Expanded(
            child: _KpiCard(
              value: '$total',
              label: lang == 'ar' ? 'الإجمالي' : 'Total',
              color: colors.brandNavy,
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: _KpiCard(
              value: '$pipeline',
              label: lang == 'ar' ? 'في المسار' : 'Pipeline',
              color: colors.brandGold,
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: _KpiCard(
              value: '$won',
              label: lang == 'ar' ? 'مكتمل' : 'Won',
              color: colors.success,
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.value,
    required this.label,
    required this.color,
  });
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        border: Border.all(color: color.withValues(alpha: 0.18)),
        borderRadius: AppRadii.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: color,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: colors.inkMuted,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Lead card ─────────────────────────────────────────────────────────────────

class _LeadCard extends StatelessWidget {
  const _LeadCard({required this.lead});
  final Lead lead;

  @override
  Widget build(BuildContext context) {
    final l10n       = context.l10n;
    final colors     = context.appColors;
    final lang       = Localizations.localeOf(context).languageCode;
    final stageColor = _stageColor(lead.stage, colors);
    final initials   = _initials(lead.fullName);

    return Container(
      decoration: BoxDecoration(
        borderRadius: AppRadii.card,
        boxShadow: colors.shadowCard,
      ),
      child: ClipRRect(
        borderRadius: AppRadii.card,
        child: Material(
          color: colors.surface,
          child: InkWell(
            onTap: () => context.push('/leads/${lead.id}', extra: lead),
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: colors.hairline, width: 0.5),
                borderRadius: AppRadii.card,
              ),
              child: Stack(
                children: [
                  // Colored start-side indicator (right in RTL)
                  PositionedDirectional(
                    top: 0,
                    bottom: 0,
                    start: 0,
                    child: Container(width: 4, color: stageColor),
                  ),
                  // Main content
                  Padding(
                    padding: const EdgeInsetsDirectional.fromSTEB(
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.md,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Row 1: avatar + name/project + badge + chevron ──
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // Avatar — RTL index 0 = right side
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: stageColor.withValues(alpha: 0.12),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: stageColor.withValues(alpha: 0.28),
                                ),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                initials,
                                style: TextStyle(
                                  color: stageColor,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  height: 1,
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            // Name + project/phone
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    lead.fullName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                      color: colors.inkStrong,
                                      height: 1.2,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  if (lead.projectInterest != null)
                                    Row(
                                      children: [
                                        Icon(
                                          Icons.apartment_outlined,
                                          size: 12,
                                          color: colors.inkMuted,
                                        ),
                                        const SizedBox(width: 3),
                                        Expanded(
                                          child: Text(
                                            lead.projectInterest!,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: colors.inkMuted,
                                              height: 1.3,
                                            ),
                                          ),
                                        ),
                                      ],
                                    )
                                  else if (lead.phone != null)
                                    Text(
                                      lead.phone!,
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: colors.inkMuted,
                                        height: 1.3,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            // Stage badge
                            StatusBadge(
                              label: leadStageLabel(l10n, lead.stage),
                              tone: leadStageTone(lead.stage),
                            ),
                            const SizedBox(width: AppSpacing.xxs),
                            // chevron_right auto-mirrors to ‹ in RTL
                            Icon(
                              Icons.chevron_right_rounded,
                              size: 20,
                              color: colors.inkMuted,
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        // Divider
                        Container(height: 0.5, color: colors.hairline),
                        const SizedBox(height: AppSpacing.xs),
                        // ── Row 2: date chip + call button ──────────────────
                        Row(
                          children: [
                            if (lead.createdAt != null)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.xs,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: colors.brandNavy.withValues(alpha: 0.06),
                                  border: Border.all(
                                    color: colors.brandNavy
                                        .withValues(alpha: 0.14),
                                  ),
                                  borderRadius: AppRadii.pillAll,
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.calendar_today_outlined,
                                      size: 11,
                                      color: colors.brandNavy
                                          .withValues(alpha: 0.65),
                                    ),
                                    const SizedBox(width: AppSpacing.xxs),
                                    Text(
                                      DateFormatter.shortDate(
                                        lead.createdAt!,
                                        languageCode: lang,
                                      ),
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: colors.brandNavy,
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            else
                              const SizedBox.shrink(),
                            const Spacer(),
                            // Call button — RTL last = left side
                            if (lead.phone != null)
                              GestureDetector(
                                onTap: () => ContactActions.call(lead.phone!),
                                behavior: HitTestBehavior.opaque,
                                child: Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: colors.success
                                        .withValues(alpha: 0.10),
                                    border: Border.all(
                                      color: colors.success
                                          .withValues(alpha: 0.25),
                                    ),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    Icons.call_rounded,
                                    size: 16,
                                    color: colors.success,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
