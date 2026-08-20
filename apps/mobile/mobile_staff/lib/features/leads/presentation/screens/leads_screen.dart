import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/lead.dart';
import '../cubit/leads_cubit.dart';

export '../cubit/leads_cubit.dart' show LeadSource;

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

  void _showFilterSheet(BuildContext context, LeadsCubit cubit) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LeadFilterSheet(cubit: cubit),
    );
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
            buildWhen: (a, b) => a.mine != b.mine || a.hasAdvancedFilters != b.hasAdvancedFilters,
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
                NavHeaderAction(
                  icon: state.hasAdvancedFilters
                      ? Icons.filter_alt_rounded
                      : Icons.filter_alt_outlined,
                  tooltip: l10n.leadsFilterSheet,
                  onTap: () => _showFilterSheet(context, cubit),
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
          // ── Active advanced filter chips ─────────────────────────────────────
          BlocBuilder<LeadsCubit, LeadsListState>(
            buildWhen: (a, b) =>
                a.sourceId != b.sourceId ||
                a.dateFrom != b.dateFrom ||
                a.dateTo != b.dateTo,
            builder: (context, state) {
              if (!state.hasAdvancedFilters) return const SizedBox.shrink();
              return _ActiveFilterChips(state: state, cubit: cubit, lang: lang);
            },
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
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm + 2, vertical: 6),
        decoration: BoxDecoration(
          gradient: active
              ? const LinearGradient(
                  colors: [Color(0xFFAA8528), AppPalette.gold400],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: active ? null : colors.surface,
          border: Border.all(
            color: active ? AppPalette.gold500 : colors.hairline,
            width: active ? 0.8 : 1.0,
          ),
          borderRadius: AppRadii.pillAll,
          boxShadow: active
              ? [
                  BoxShadow(
                    color: AppPalette.gold400.withValues(alpha: 0.25),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: active ? FontWeight.w700 : FontWeight.w600,
            color: active ? AppPalette.navy : colors.inkStrong,
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
      padding: const EdgeInsets.fromLTRB(AppSpacing.sm, AppSpacing.sm, AppSpacing.sm, AppSpacing.sm),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin:  Alignment.topLeft,
          end:    Alignment.bottomRight,
          colors: [color.withValues(alpha: 0.12), color.withValues(alpha: 0.04)],
        ),
        border:       Border.all(color: color.withValues(alpha: 0.22)),
        borderRadius: AppRadii.card,
        boxShadow: [
          BoxShadow(
            color:      color.withValues(alpha: 0.10),
            blurRadius: 10,
            offset:     const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize:   24,
              fontWeight: FontWeight.w800,
              color:      color,
              height:     1.1,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: TextStyle(
              fontSize:   11,
              fontWeight: FontWeight.w600,
              color:      colors.inkMuted,
              height:     1.2,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Lead card ─────────────────────────────────────────────────────────────────

class _LeadCard extends StatefulWidget {
  const _LeadCard({required this.lead});
  final Lead lead;

  @override
  State<_LeadCard> createState() => _LeadCardState();
}

class _LeadCardState extends State<_LeadCard> {
  bool _pressed = false;
  Lead get lead => widget.lead;

  @override
  Widget build(BuildContext context) {
    final l10n       = context.l10n;
    final colors     = context.appColors;
    final lang       = Localizations.localeOf(context).languageCode;
    final isRtl      = context.read<LocaleCubit>().isRtl;
    final stageColor = _stageColor(lead.stage, colors);
    final initials   = _initials(lead.fullName);

    return GestureDetector(
      onTapDown:   (_) => setState(() => _pressed = true),
      onTapUp:     (_) => setState(() => _pressed = false),
      onTapCancel: ()  => setState(() => _pressed = false),
      onTap: () => context.push('/leads/${lead.id}', extra: lead),
      child: AnimatedScale(
        scale:    _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve:    Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color:        colors.surface,
            borderRadius: AppRadii.card,
            border:       Border.all(color: stageColor.withValues(alpha: 0.14), width: 0.8),
            boxShadow: [
              BoxShadow(
                color:      stageColor.withValues(alpha: 0.08),
                blurRadius: 18,
                offset:     const Offset(0, 5),
              ),
              BoxShadow(
                color:      Colors.black.withValues(alpha: 0.04),
                blurRadius: 6,
                offset:     const Offset(0, 2),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize:       MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Top gradient accent strip ─────────────────────────────
              Container(
                height: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin:  isRtl ? Alignment.centerRight : Alignment.centerLeft,
                    end:    isRtl ? Alignment.centerLeft  : Alignment.centerRight,
                    colors: [stageColor, stageColor.withValues(alpha: 0.0)],
                  ),
                ),
              ),
              // ── Card body ─────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md, AppSpacing.sm,
                  AppSpacing.md, AppSpacing.sm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Avatar + name/project + badge + chevron ──────────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Container(
                          width:  44,
                          height: 44,
                          decoration: BoxDecoration(
                            color:  stageColor.withValues(alpha: 0.12),
                            shape:  BoxShape.circle,
                            border: Border.all(color: stageColor.withValues(alpha: 0.30)),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            initials,
                            style: TextStyle(
                              color:      stageColor,
                              fontSize:   15,
                              fontWeight: FontWeight.w700,
                              height:     1,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                lead.fullName,
                                maxLines:  1,
                                overflow:  TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize:   15,
                                  fontWeight: FontWeight.w700,
                                  color:      colors.inkStrong,
                                  height:     1.2,
                                ),
                              ),
                              const SizedBox(height: 2),
                              if (lead.projectInterest != null)
                                Row(
                                  children: [
                                    Icon(Icons.apartment_outlined, size: 12, color: colors.inkMuted),
                                    const SizedBox(width: 3),
                                    Expanded(
                                      child: Text(
                                        lead.projectInterest!,
                                        maxLines:  1,
                                        overflow:  TextOverflow.ellipsis,
                                        style: TextStyle(fontSize: 12, color: colors.inkMuted, height: 1.3),
                                      ),
                                    ),
                                  ],
                                )
                              else if (lead.phone != null)
                                Text(
                                  lead.phone!,
                                  style: TextStyle(fontSize: 12, color: colors.inkMuted, height: 1.3),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        StatusBadge(
                          label: leadStageLabel(l10n, lead.stage),
                          tone:  leadStageTone(lead.stage),
                        ),
                        const SizedBox(width: AppSpacing.xxs),
                        Icon(Icons.chevron_right_rounded, size: 20, color: colors.inkMuted),
                      ],
                    ),
                    // ── Date chip + call button ──────────────────────────
                    const SizedBox(height: AppSpacing.xs),
                    Container(height: 0.5, color: colors.hairline),
                    const SizedBox(height: AppSpacing.xs),
                    Row(
                      children: [
                        if (lead.createdAt != null)
                          _LeadInfoChip(
                            icon:  Icons.calendar_today_outlined,
                            label: DateFormatter.shortDate(lead.createdAt!, languageCode: lang),
                            color: colors.brandNavy,
                          )
                        else
                          const SizedBox.shrink(),
                        const Spacer(),
                        if (lead.phone != null)
                          GestureDetector(
                            onTap:    () => ContactActions.call(lead.phone!),
                            behavior: HitTestBehavior.opaque,
                            child: Container(
                              width:  34,
                              height: 34,
                              decoration: BoxDecoration(
                                color:  colors.success.withValues(alpha: 0.10),
                                border: Border.all(color: colors.success.withValues(alpha: 0.25)),
                                shape:  BoxShape.circle,
                              ),
                              child: Icon(Icons.call_rounded, size: 15, color: colors.success),
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
    );
  }
}

// ── Shared info chip ──────────────────────────────────────────────────────────

class _LeadInfoChip extends StatelessWidget {
  const _LeadInfoChip({
    required this.icon,
    required this.label,
    required this.color,
  });
  final IconData icon;
  final String   label;
  final Color    color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color:        color.withValues(alpha: 0.07),
        border:       Border.all(color: color.withValues(alpha: 0.20)),
        borderRadius: AppRadii.pillAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color.withValues(alpha: 0.80)),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize:   11,
              fontWeight: FontWeight.w600,
              color:      color,
              height:     1.2,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Active filter chip row ────────────────────────────────────────────────────

class _ActiveFilterChips extends StatelessWidget {
  const _ActiveFilterChips({
    required this.state,
    required this.cubit,
    required this.lang,
  });
  final LeadsListState state;
  final LeadsCubit cubit;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, 0, AppSpacing.md, AppSpacing.xs),
      child: Row(
        children: [
          // Clear-all chip
          _DismissChip(
            label: l10n.leadsFilterClear,
            icon: Icons.close_rounded,
            onTap: cubit.clearAdvancedFilters,
            colors: colors,
            accent: colors.error,
          ),
          const SizedBox(width: AppSpacing.xs),
          if (state.sourceId != null) ...[
            _DismissChip(
              label: lang == 'ar' ? 'المصدر: …' : 'Source: …',
              onTap: () => cubit.setAdvancedFilters(clearSourceId: true),
              colors: colors,
            ),
            const SizedBox(width: AppSpacing.xs),
          ],
          if (state.dateFrom != null) ...[
            _DismissChip(
              label: '${lang == 'ar' ? 'من' : 'From'}: ${state.dateFrom}',
              onTap: () => cubit.setAdvancedFilters(clearDateFrom: true),
              colors: colors,
            ),
            const SizedBox(width: AppSpacing.xs),
          ],
          if (state.dateTo != null)
            _DismissChip(
              label: '${lang == 'ar' ? 'إلى' : 'To'}: ${state.dateTo}',
              onTap: () => cubit.setAdvancedFilters(clearDateTo: true),
              colors: colors,
            ),
        ],
      ),
    );
  }
}

class _DismissChip extends StatelessWidget {
  const _DismissChip({
    required this.label,
    required this.onTap,
    required this.colors,
    this.icon = Icons.cancel_outlined,
    this.accent,
  });
  final String label;
  final VoidCallback onTap;
  final AppColorsExt colors;
  final IconData icon;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final color = accent ?? colors.brandGold;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          border: Border.all(color: color.withValues(alpha: 0.30)),
          borderRadius: AppRadii.pillAll,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
                height: 1.2,
              ),
            ),
            const SizedBox(width: 4),
            Icon(icon, size: 13, color: color),
          ],
        ),
      ),
    );
  }
}

// ── Filter bottom sheet ───────────────────────────────────────────────────────

class _LeadFilterSheet extends StatefulWidget {
  const _LeadFilterSheet({required this.cubit});
  final LeadsCubit cubit;

  @override
  State<_LeadFilterSheet> createState() => _LeadFilterSheetState();
}

class _LeadFilterSheetState extends State<_LeadFilterSheet> {
  List<LeadSource> _sources = [];
  bool _loadingSources = true;

  String? _sourceId;
  String? _dateFrom;
  String? _dateTo;

  @override
  void initState() {
    super.initState();
    final s = widget.cubit.state;
    _sourceId = s.sourceId;
    _dateFrom = s.dateFrom;
    _dateTo = s.dateTo;
    _loadSources();
  }

  Future<void> _loadSources() async {
    final sources = await widget.cubit.fetchSources();
    if (mounted) setState(() { _sources = sources; _loadingSources = false; });
  }

  Future<void> _pickDate(bool isFrom) async {
    final initial = DateTime.tryParse(isFrom ? (_dateFrom ?? '') : (_dateTo ?? ''))
        ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null && mounted) {
      final iso = '${picked.year.toString().padLeft(4, '0')}-'
          '${picked.month.toString().padLeft(2, '0')}-'
          '${picked.day.toString().padLeft(2, '0')}';
      setState(() { if (isFrom) { _dateFrom = iso; } else { _dateTo = iso; } });
    }
  }

  void _apply() {
    widget.cubit.setAdvancedFilters(
      sourceId: _sourceId,
      clearSourceId: _sourceId == null,
      dateFrom: _dateFrom,
      clearDateFrom: _dateFrom == null,
      dateTo: _dateTo,
      clearDateTo: _dateTo == null,
    );
    Navigator.of(context).pop();
  }

  void _clear() {
    setState(() { _sourceId = null; _dateFrom = null; _dateTo = null; });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, bottomPad + AppSpacing.md),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Handle
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(color: colors.hairline, borderRadius: AppRadii.pillAll),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          // Title row
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.leadsFilterSheet,
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: colors.inkStrong),
                ),
              ),
              TextButton(
                onPressed: _clear,
                child: Text(l10n.leadsFilterClear, style: TextStyle(color: colors.error, fontSize: 13)),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // Source picker
          Text(l10n.leadsFilterSource,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.inkMuted)),
          const SizedBox(height: AppSpacing.xs),
          if (_loadingSources)
            const Center(child: SizedBox(height: 32, width: 32, child: CircularProgressIndicator(strokeWidth: 2)))
          else
            SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _FilterChip(
                    label: lang == 'ar' ? 'الكل' : 'All',
                    active: _sourceId == null,
                    onTap: () => setState(() => _sourceId = null),
                  ),
                  for (final src in _sources) ...[
                    const SizedBox(width: AppSpacing.xs),
                    _FilterChip(
                      label: src.name,
                      active: _sourceId == src.id,
                      onTap: () => setState(() => _sourceId = _sourceId == src.id ? null : src.id),
                    ),
                  ],
                ],
              ),
            ),
          const SizedBox(height: AppSpacing.md),

          // Date range
          Text(
            lang == 'ar' ? 'نطاق التاريخ' : 'Date range',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.inkMuted),
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(child: _DateButton(
                label: _dateFrom ?? l10n.leadsFilterDateFrom,
                hasValue: _dateFrom != null,
                onTap: () => _pickDate(true),
                onClear: _dateFrom != null ? () => setState(() => _dateFrom = null) : null,
                colors: colors,
              )),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: _DateButton(
                label: _dateTo ?? l10n.leadsFilterDateTo,
                hasValue: _dateTo != null,
                onTap: () => _pickDate(false),
                onClear: _dateTo != null ? () => setState(() => _dateTo = null) : null,
                colors: colors,
              )),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),

          // Apply button
          FilledButton(
            onPressed: _apply,
            child: Text(l10n.leadsFilterApply),
          ),
        ],
      ),
    );
  }
}

class _DateButton extends StatelessWidget {
  const _DateButton({
    required this.label,
    required this.hasValue,
    required this.onTap,
    required this.colors,
    this.onClear,
  });
  final String label;
  final bool hasValue;
  final VoidCallback onTap;
  final VoidCallback? onClear;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 10),
        decoration: BoxDecoration(
          color: hasValue ? colors.brandNavy.withValues(alpha: 0.06) : colors.surface,
          border: Border.all(
            color: hasValue ? colors.brandNavy.withValues(alpha: 0.25) : colors.hairline,
          ),
          borderRadius: AppRadii.card,
        ),
        child: Row(
          children: [
            Icon(Icons.calendar_today_outlined, size: 14,
                color: hasValue ? colors.brandNavy : colors.inkMuted),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  color: hasValue ? colors.inkStrong : colors.inkMuted,
                  fontWeight: hasValue ? FontWeight.w600 : FontWeight.w400,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (onClear != null)
              GestureDetector(
                onTap: onClear,
                child: Icon(Icons.close_rounded, size: 14, color: colors.inkMuted),
              ),
          ],
        ),
      ),
    );
  }
}
