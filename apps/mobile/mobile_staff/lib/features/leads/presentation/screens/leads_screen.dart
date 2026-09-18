import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/lead.dart';
import '../cubit/leads_cubit.dart';

export '../cubit/leads_cubit.dart' show LeadSource;

// ── Helpers ────────────────────────────────────────────────────────────────────

Color _stageColor(String stage, AppColorsExt colors) => switch (stage) {
  'NEW' => colors.inkMuted,
  'INTERESTED' => colors.info,
  'VISIT' => colors.brandGold,
  'NEGOTIATION' => colors.warning,
  'WON' => colors.success,
  'LOST' => colors.error,
  _ => colors.inkMuted,
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
    final l10n = context.l10n;
    final cubit = context.read<LeadsCubit>();
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final lang = Localizations.localeOf(context).languageCode;

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
          // ── Header + embedded search ────────────────────────────────────────
          BlocBuilder<LeadsCubit, LeadsListState>(
            buildWhen: (a, b) =>
                a.mine != b.mine ||
                a.hasAdvancedFilters != b.hasAdvancedFilters,
            builder: (context, state) => _LeadsHeader(
              title: l10n.navLeads,
              isMine: state.mine,
              hasFilters: state.hasAdvancedFilters,
              searchController: _search,
              searchHint: l10n.leadsSearchHint,
              onToggleMine: cubit.toggleMine,
              onFilterTap: () => _showFilterSheet(context, cubit),
              onSearch: cubit.setSearch,
              onClearSearch: () {
                _search.clear();
                cubit.setSearch('');
              },
            ),
          ),
          // ── Stage filter chips ───────────────────────────────────────────────
          BlocBuilder<LeadsCubit, LeadsListState>(
            buildWhen: (a, b) =>
                a.stage != b.stage ||
                a.leads != b.leads ||
                a.status != b.status,
            builder: (context, state) {
              final stageCounts = <String, int>{};
              for (final lead in state.leads) {
                stageCounts[lead.stage] = (stageCounts[lead.stage] ?? 0) + 1;
              }
              return _StageFilterRow(
                selected: state.stage,
                lang: lang,
                stageCounts: stageCounts,
                totalCount: state.leads.length,
                onSelected: (s) => cubit.setStage(s == state.stage ? null : s),
              );
            },
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
                              delegate: SliverChildBuilderDelegate((
                                context,
                                i,
                              ) {
                                if (i.isOdd) {
                                  return const SizedBox(height: AppSpacing.sm);
                                }
                                return _LeadCard(lead: state.leads[i ~/ 2]);
                              }, childCount: state.leads.length * 2 - 1),
                            ),
                          ),
                          if (state.isLoadingMore)
                            const SliverToBoxAdapter(
                              child: Padding(
                                padding: EdgeInsets.symmetric(
                                  vertical: AppSpacing.md,
                                ),
                                child: Center(
                                  child: CircularProgressIndicator(),
                                ),
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

// ── Leads-specific header (avoids core-package hot-reload issues) ─────────────

class _LeadsHeader extends StatelessWidget {
  const _LeadsHeader({
    required this.title,
    required this.isMine,
    required this.hasFilters,
    required this.searchController,
    required this.searchHint,
    required this.onToggleMine,
    required this.onFilterTap,
    required this.onSearch,
    required this.onClearSearch,
  });

  final String title;
  final bool isMine;
  final bool hasFilters;
  final TextEditingController searchController;
  final String searchHint;
  final VoidCallback onToggleMine;
  final VoidCallback onFilterTap;
  final ValueChanged<String> onSearch;
  final VoidCallback onClearSearch;

  static const _navyDeep = Color(0xFF0B1726);
  static const _navyMid = Color(0xFF14273F);
  static const _navyLight = Color(0xFF243F62);

  @override
  Widget build(BuildContext context) {
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
            // Dot texture
            const Positioned.fill(
              child: ClipRRect(
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(AppRadii.xl + 4),
                  bottomRight: Radius.circular(AppRadii.xl + 4),
                ),
                child: IgnorePointer(child: _HeaderDotsBg()),
              ),
            ),
            // Gold radial bloom
            PositionedDirectional(
              top: 0,
              end: -30,
              child: Container(
                width: 200,
                height: 200,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x1EC8A24B), Color(0x00C8A24B)],
                    stops: [0.0, 0.75],
                  ),
                ),
              ),
            ),
            // Gold hairline at bottom
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
            // Content
            SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.lg,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Action buttons row
                    Row(
                      children: [
                        Text(
                          title,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const Spacer(),
                        _GlassBtn(
                          icon: isMine
                              ? Icons.person_rounded
                              : Icons.person_outline_rounded,
                          onTap: onToggleMine,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        _GlassBtn(
                          icon: hasFilters
                              ? Icons.filter_alt_rounded
                              : Icons.filter_alt_outlined,
                          onTap: onFilterTap,
                        ),
                      ],
                    ),

                    // ── gap between buttons and title ──

                    // Title
                    const SizedBox(height: AppSpacing.md),

                    // Search bar
                    _NavSearchBar(
                      controller: searchController,
                      hint: searchHint,
                      onSubmitted: onSearch,
                      onClear: onClearSearch,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GlassBtn extends StatelessWidget {
  const _GlassBtn({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white.withValues(alpha: 0.10),
    shape: const CircleBorder(),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.20),
            width: 0.8,
          ),
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    ),
  );
}

class _HeaderDotsBg extends StatelessWidget {
  const _HeaderDotsBg();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotsBgPainter(), child: SizedBox.expand());
}

class _DotsBgPainter extends CustomPainter {
  const _DotsBgPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 8.0; y < size.height; y += step) {
      for (var x = 8.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotsBgPainter _) => false;
}

// ── Nav search bar (white pill embedded in AppNavHeader bottom:) ──────────────

class _NavSearchBar extends StatefulWidget {
  const _NavSearchBar({
    required this.controller,
    required this.hint,
    required this.onSubmitted,
    required this.onClear,
  });
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onSubmitted;
  final VoidCallback onClear;

  @override
  State<_NavSearchBar> createState() => _NavSearchBarState();
}

class _NavSearchBarState extends State<_NavSearchBar> {
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(
      () => setState(() => _hasText = widget.controller.text.isNotEmpty),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.pillAll,
        border: Border.all(color: colors.hairline),
        boxShadow: colors.shadowSoft,
      ),
      child: Row(
        children: [
          const SizedBox(width: AppSpacing.md),
          Icon(Icons.search_rounded, size: 20, color: colors.inkMuted),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: TextField(
              controller: widget.controller,
              onSubmitted: widget.onSubmitted,
              textInputAction: TextInputAction.search,
              style: theme.textTheme.bodyMedium,
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
                hintText: widget.hint,
                hintStyle: theme.textTheme.bodyMedium?.copyWith(
                  color: colors.inkMuted,
                ),
              ),
            ),
          ),
          if (_hasText)
            IconButton(
              visualDensity: VisualDensity.compact,
              icon: Icon(Icons.close_rounded, size: 18, color: colors.inkMuted),
              onPressed: widget.onClear,
            ),
          const SizedBox(width: AppSpacing.xs),
        ],
      ),
    );
  }
}

// ── Stage filter row ──────────────────────────────────────────────────────────

class _StageFilterRow extends StatelessWidget {
  const _StageFilterRow({
    required this.selected,
    required this.lang,
    required this.stageCounts,
    required this.totalCount,
    required this.onSelected,
  });
  final String? selected;
  final String lang;
  final Map<String, int> stageCounts;
  final int totalCount;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(bottom: BorderSide(color: colors.hairline, width: 0.5)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: 6,
        ),
        child: Row(
          children: [
            _FilterChip(
              label: lang == 'ar' ? 'الكل' : 'All',
              count: totalCount,
              active: selected == null,
              onTap: () => onSelected(null),
            ),
            const SizedBox(width: AppSpacing.xs),
            for (final stage in kLeadStages) ...[
              _FilterChip(
                label: leadStageLabel(l10n, stage),
                count: stageCounts[stage] ?? 0,
                dotColor: _stageColor(stage, colors),
                active: selected == stage,
                onTap: () => onSelected(stage),
              ),
              if (stage != kLeadStages.last)
                const SizedBox(width: AppSpacing.xs),
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
    this.count,
    this.dotColor,
  });
  final String label;
  final int? count;
  final bool active;
  final VoidCallback onTap;
  final Color? dotColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm + 4,
          vertical: 11,
        ),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(
            color: active ? colors.brandNavy : colors.hairline,
            width: active ? 0 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Count badge — always visible when count is provided
            if (count != null) ...[
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.xs,
                  vertical: 2,
                ),
                decoration: BoxDecoration(
                  color: active
                      ? Colors.white.withValues(alpha: 0.18)
                      : colors.surfaceSoft,
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: active ? Colors.white : colors.inkStrong,
                    height: 1.2,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
            ],
            // Status dot — inactive only
            if (!active && dotColor != null) ...[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: AppSpacing.xxs + 2),
            ],
            // Label
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                color: active ? Colors.white : colors.inkStrong,
                height: 1.2,
              ),
            ),
          ],
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
    final colors = context.appColors;
    final total = leads.length;
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
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadii.card,
          border: Border.all(color: colors.hairline, width: 0.8),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: IntrinsicHeight(
          child: Row(
            children: [
              Expanded(
                child: _KpiStat(
                  value: '$total',
                  label: lang == 'ar' ? 'الإجمالي' : 'Total',
                  color: colors.brandNavy,
                ),
              ),
              VerticalDivider(width: 1, thickness: 0.8, color: colors.hairline),
              Expanded(
                child: _KpiStat(
                  value: '$pipeline',
                  label: lang == 'ar' ? 'في المسار' : 'Pipeline',
                  color: colors.brandGold,
                ),
              ),
              VerticalDivider(width: 1, thickness: 0.8, color: colors.hairline),
              Expanded(
                child: _KpiStat(
                  value: '$won',
                  label: lang == 'ar' ? 'مكتمل' : 'Won',
                  color: colors.success,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _KpiStat extends StatelessWidget {
  const _KpiStat({
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
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: color,
              height: 1.1,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 3),
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
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final isRtl = context.read<LocaleCubit>().isRtl;
    final stageColor = _stageColor(lead.stage, colors);
    final initials = _initials(lead.fullName);

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => context.push('/leads/${lead.id}', extra: lead),
      child: AnimatedScale(
        scale: _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadii.card,
            border: Border.all(
              color: stageColor.withValues(alpha: 0.14),
              width: 0.8,
            ),
            boxShadow: [
              BoxShadow(
                color: stageColor.withValues(alpha: 0.08),
                blurRadius: 18,
                offset: const Offset(0, 5),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Top gradient accent strip ─────────────────────────────
              Container(
                height: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: isRtl ? Alignment.centerRight : Alignment.centerLeft,
                    end: isRtl ? Alignment.centerLeft : Alignment.centerRight,
                    colors: [stageColor, stageColor.withValues(alpha: 0.0)],
                  ),
                ),
              ),
              // ── Card body ─────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.md,
                  AppSpacing.sm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Avatar + name/project + badge + chevron ──────────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: stageColor.withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: stageColor.withValues(alpha: 0.30),
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
                        StatusBadge(
                          label: leadStageLabel(l10n, lead.stage),
                          tone: leadStageTone(lead.stage),
                        ),
                        const SizedBox(width: AppSpacing.xxs),
                        Icon(
                          Icons.chevron_right_rounded,
                          size: 20,
                          color: colors.inkMuted,
                        ),
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
                            icon: Icons.calendar_today_outlined,
                            label: DateFormatter.shortDate(
                              lead.createdAt!,
                              languageCode: lang,
                            ),
                            color: colors.brandNavy,
                          )
                        else
                          const SizedBox.shrink(),
                        const Spacer(),
                        if (lead.phone != null)
                          GestureDetector(
                            onTap: () => ContactActions.call(lead.phone!),
                            behavior: HitTestBehavior.opaque,
                            child: Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: colors.success.withValues(alpha: 0.10),
                                border: Border.all(
                                  color: colors.success.withValues(alpha: 0.25),
                                ),
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
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        border: Border.all(color: color.withValues(alpha: 0.20)),
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
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
              height: 1.2,
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
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        AppSpacing.xs,
      ),
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
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: 4,
        ),
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
    if (mounted) {
      setState(() {
        _sources = sources;
        _loadingSources = false;
      });
    }
  }

  Future<void> _pickDate(bool isFrom) async {
    final initial =
        DateTime.tryParse(isFrom ? (_dateFrom ?? '') : (_dateTo ?? '')) ??
        DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null && mounted) {
      final iso =
          '${picked.year.toString().padLeft(4, '0')}-'
          '${picked.month.toString().padLeft(2, '0')}-'
          '${picked.day.toString().padLeft(2, '0')}';
      setState(() {
        if (isFrom) {
          _dateFrom = iso;
        } else {
          _dateTo = iso;
        }
      });
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
    setState(() {
      _sourceId = null;
      _dateFrom = null;
      _dateTo = null;
    });
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
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        bottomPad + AppSpacing.md,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.hairline,
                borderRadius: AppRadii.pillAll,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          // Title row
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.leadsFilterSheet,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: colors.inkStrong,
                  ),
                ),
              ),
              TextButton(
                onPressed: _clear,
                child: Text(
                  l10n.leadsFilterClear,
                  style: TextStyle(color: colors.error, fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // Source picker
          Text(
            l10n.leadsFilterSource,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: colors.inkMuted,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          if (_loadingSources)
            const Center(
              child: SizedBox(
                height: 32,
                width: 32,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
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
                      onTap: () => setState(
                        () => _sourceId = _sourceId == src.id ? null : src.id,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          const SizedBox(height: AppSpacing.md),

          // Date range
          Text(
            lang == 'ar' ? 'نطاق التاريخ' : 'Date range',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: colors.inkMuted,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: _DateButton(
                  label: _dateFrom ?? l10n.leadsFilterDateFrom,
                  hasValue: _dateFrom != null,
                  onTap: () => _pickDate(true),
                  onClear: _dateFrom != null
                      ? () => setState(() => _dateFrom = null)
                      : null,
                  colors: colors,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _DateButton(
                  label: _dateTo ?? l10n.leadsFilterDateTo,
                  hasValue: _dateTo != null,
                  onTap: () => _pickDate(false),
                  onClear: _dateTo != null
                      ? () => setState(() => _dateTo = null)
                      : null,
                  colors: colors,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),

          // Apply button
          FilledButton(onPressed: _apply, child: Text(l10n.leadsFilterApply)),
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
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: 10,
        ),
        decoration: BoxDecoration(
          color: hasValue
              ? colors.brandNavy.withValues(alpha: 0.06)
              : colors.surface,
          border: Border.all(
            color: hasValue
                ? colors.brandNavy.withValues(alpha: 0.25)
                : colors.hairline,
          ),
          borderRadius: AppRadii.card,
        ),
        child: Row(
          children: [
            Icon(
              Icons.calendar_today_outlined,
              size: 14,
              color: hasValue ? colors.brandNavy : colors.inkMuted,
            ),
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
                child: Icon(
                  Icons.close_rounded,
                  size: 14,
                  color: colors.inkMuted,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
