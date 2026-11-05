import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../../common/visit_status_label.dart';
import '../../../dashboard/home_kit/filter_kit.dart';
import '../../../dashboard/home_kit/home_kit.dart';
import '../../domain/entities/visit.dart';
import '../cubit/visits_cubit.dart';

class VisitsScreen extends StatefulWidget {
  const VisitsScreen({super.key});

  @override
  State<VisitsScreen> createState() => _VisitsScreenState();
}

class _VisitsScreenState extends State<VisitsScreen> {
  final _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<VisitsCubit>().load();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 200) {
      context.read<VisitsCubit>().loadMore();
    }
  }

  Future<void> _create() async {
    final created = await context.push<bool>('/visits/new');
    if (created == true && mounted) context.read<VisitsCubit>().load();
  }

  void _filters() {
    final cubit = context.read<VisitsCubit>();
    showFilterSheet(context, (_) => _StatusSheet(selected: cubit.state.statusFilter, onApply: cubit.setStatus));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<VisitsCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocBuilder<VisitsCubit, VisitsListState>(
          builder: (context, state) {
            final ready = state.status == DataStatus.success;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                key: const Key('visits'),
                controller: _scrollCtrl,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      back: true,
                      title: l10n.navVisits,
                      subtitle: ready ? l10n.visitsCountN(state.visits.length) : null,
                      actions: [
                        HomeHeroButton(
                          key: const Key('visits-today'),
                          icon: Icons.today_rounded,
                          active: state.today,
                          tooltip: l10n.visitsToday,
                          onTap: cubit.toggleToday,
                        ),
                        HomeHeroButton(
                          key: const Key('visits-filters'),
                          icon: Icons.tune_rounded,
                          dot: state.statusFilter != null,
                          tooltip: l10n.visitsFilterTitle,
                          onTap: _filters,
                        ),
                      ],
                    ),
                  ),
                  ...switch (state.status) {
                    DataStatus.initial || DataStatus.loading => [const SliverToBoxAdapter(child: SizedBox(height: 480, child: StaffListSkeleton()))],
                    DataStatus.failure => [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: cubit.load))],
                    DataStatus.empty => [
                        SliverToBoxAdapter(
                          child: EmptyState(icon: Icons.event_busy_outlined, title: l10n.visitsEmptyTitle, message: l10n.visitsEmptyMessage),
                        ),
                      ],
                    DataStatus.success => [
                        SliverPadding(
                          padding: EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, bottomPad + 100),
                          sliver: SliverList.separated(
                            itemCount: state.visits.length + (state.isLoadingMore ? 1 : 0),
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (context, i) {
                              if (i == state.visits.length) {
                                return const Padding(padding: EdgeInsets.symmetric(vertical: AppSpacing.md), child: Center(child: CircularProgressIndicator()));
                              }
                              return _VisitTile(visit: state.visits[i]);
                            },
                          ),
                        ),
                      ],
                  },
                ],
              ),
            );
          },
        ),
        floatingActionButton: FloatingActionButton(
          onPressed: _create,
          tooltip: l10n.visitNew,
          backgroundColor: AppPalette.gold400,
          foregroundColor: AppPalette.navy,
          child: const Icon(Icons.add_rounded),
        ),
      ),
    );
  }
}

// ── Status filter sheet ───────────────────────────────────────────────────────

const _kVisitDotColors = <String, Color>{
  'SCHEDULED': Color(0xFF60A5FA), // blue
  'CONFIRMED': Color(0xFFC9A84C), // gold
  'PENDING_RESCHEDULE': Color(0xFFF59E0B), // amber
  'COMPLETED': Color(0xFF22C55E), // green
  'CANCELLED': Color(0xFFEF4444), // red
  'NO_SHOW': Color(0xFF9CA3AF), // muted gray
};

class _StatusSheet extends StatefulWidget {
  const _StatusSheet({required this.selected, required this.onApply});
  final String? selected;
  final ValueChanged<String?> onApply;

  @override
  State<_StatusSheet> createState() => _StatusSheetState();
}

class _StatusSheetState extends State<_StatusSheet> {
  late String? _s = widget.selected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return FilterSheet(
      title: l10n.visitsFilterTitle,
      active: _s == null ? 0 : 1,
      onClear: () => setState(() => _s = null),
      applyLabel: l10n.visitsFilterApply,
      onApply: () {
        widget.onApply(_s);
        Navigator.of(context).pop();
      },
      sections: [
        FilterSection(
          icon: Icons.flag_outlined,
          title: l10n.kcStatus,
          child: FilterRadioList<String?>(
            keyPrefix: 'visit-filter',
            selected: _s,
            onSelect: (v) => setState(() => _s = v),
            options: [
              FilterOption<String?>(null, l10n.leadsFilterAll),
              for (final st in kVisitStatuses) FilterOption<String?>(st, visitStatusLabel(l10n, st), color: _kVisitDotColors[st]),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Visit tile ────────────────────────────────────────────────────────────────

class _VisitTile extends StatefulWidget {
  const _VisitTile({required this.visit});
  final Visit visit;

  @override
  State<_VisitTile> createState() => _VisitTileState();
}

class _VisitTileState extends State<_VisitTile> {
  bool _pressed = false;
  Visit get visit => widget.visit;

  static Color _toneColor(BadgeTone tone, AppColorsExt c) => switch (tone) {
    BadgeTone.success => c.success,
    BadgeTone.warning => c.warning,
    BadgeTone.error => c.error,
    BadgeTone.info => c.info,
    BadgeTone.gold => c.brandGold,
    _ => c.inkMuted,
  };

  static IconData _statusIcon(String status) => switch (status) {
    'SCHEDULED' => Icons.event_available_rounded,
    'CONFIRMED' => Icons.verified_rounded,
    'PENDING_RESCHEDULE' => Icons.pending_actions_rounded,
    'COMPLETED' => Icons.check_circle_rounded,
    'CANCELLED' => Icons.cancel_rounded,
    'NO_SHOW' => Icons.person_off_rounded,
    _ => Icons.event_rounded,
  };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final isRtl = context.read<LocaleCubit>().isRtl;
    final tone = visitStatusTone(visit.status);
    final accent = _toneColor(tone, colors);
    final hasDate = visit.scheduledAt != null;
    final hasUnit = visit.unitCode != null;
    final hasProject = visit.projectName != null;
    final primaryName = visit.clientName ?? visit.projectName ?? l10n.navVisits;
    final showProject = visit.clientName != null && hasProject;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => context.push('/visits/${visit.id}', extra: visit),
      child: AnimatedScale(
        scale: _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: colors.hairline),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Top gradient accent strip ──────────────────────────────
              Container(
                height: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: isRtl ? Alignment.centerRight : Alignment.centerLeft,
                    end: isRtl ? Alignment.centerLeft : Alignment.centerRight,
                    colors: [accent, accent.withValues(alpha: 0.0)],
                  ),
                ),
              ),
              // ── Card body ─────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  13,
                  AppSpacing.md,
                  13,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Main row: icon · content · badge · arrow ───────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Status icon circle
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(15),
                          ),
                          child: Icon(
                            _statusIcon(visit.status),
                            color: accent,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        // Name + project
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                primaryName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 15.5,
                                  fontWeight: FontWeight.w700,
                                  color: colors.inkStrong,
                                  height: 1.2,
                                  letterSpacing: -0.2,
                                ),
                              ),
                              if (showProject) ...[
                                const SizedBox(height: 3),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.apartment_rounded,
                                      size: 11,
                                      color: colors.inkMuted,
                                    ),
                                    const SizedBox(width: 3),
                                    Expanded(
                                      child: Text(
                                        visit.projectName!,
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
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Status badge + disclosure
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            StatusBadge(
                              label: visitStatusLabel(l10n, visit.status),
                              tone: tone,
                            ),
                            const SizedBox(height: 4),
                            const Icon(
                              AppIcons.chevronForward,
                              size: 18,
                              color: AppPalette.gold400,
                            ),
                          ],
                        ),
                      ],
                    ),
                    // ── Date / unit chips ─────────────────────────────
                    if (hasDate || hasUnit) ...[
                      const SizedBox(height: 10),
                      Container(height: 0.5, color: colors.hairline),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          if (hasDate)
                            _InfoChip(
                              icon: Icons.schedule_rounded,
                              label: DateFormatter.shortDate(
                                visit.scheduledAt!,
                                languageCode: lang,
                              ),
                              color: colors.brandNavy,
                            ),
                          if (hasDate && hasUnit) const SizedBox(width: 6),
                          if (hasUnit)
                            _InfoChip(
                              icon: Icons.apartment_rounded,
                              label: visit.unitCode!,
                              color: colors.brandGold,
                            ),
                        ],
                      ),
                    ],
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

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.icon,
    required this.label,
    required this.color,
  });
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppInfoChip(icon: icon, label: label, color: color);
  }
}
