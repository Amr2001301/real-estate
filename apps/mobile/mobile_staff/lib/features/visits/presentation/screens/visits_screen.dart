import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../../common/visit_status_label.dart';
import '../../../dashboard/home_kit/filter_kit.dart';
import '../../../dashboard/home_kit/home_kit.dart';
import '../../../leads/presentation/screens/leads_screen.dart' show leadWhen;
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

/// A visit as the app's other cards: the person's initials on navy, their
/// name and the project, the state, then the date and where it opens.
class _VisitTile extends StatelessWidget {
  const _VisitTile({required this.visit});
  final Visit visit;

  static Color _toneColor(BadgeTone tone, AppColorsExt c) => switch (tone) {
        BadgeTone.success => c.success,
        BadgeTone.warning => c.warning,
        BadgeTone.error => c.error,
        BadgeTone.info => c.info,
        BadgeTone.gold => c.brandGold,
        _ => c.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final tone = visitStatusTone(visit.status);
    final accent = _toneColor(tone, colors);
    final name = visit.clientName ?? visit.projectName ?? l10n.navVisits;
    final where = [
      if (visit.clientName != null && visit.projectName != null) visit.projectName!,
      if (visit.unitCode != null) ltr(visit.unitCode!),
    ].join(' · ');
    return Material(
      color: Colors.transparent,
      child: InkWell(
        key: Key('visit-${visit.id}'),
        borderRadius: BorderRadius.circular(22),
        onTap: () => context.push('/visits/${visit.id}', extra: visit),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: homeCard(context, radius: 22),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(14)),
                child: Text(homeInitials(name), style: homeDisplay(14, AppPalette.gold300)),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                  if (where.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Row(children: [
                      Icon(Icons.apartment_rounded, size: 14, color: colors.inkMuted),
                      const SizedBox(width: 4),
                      Expanded(child: Text(where, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: colors.inkMuted))),
                    ]),
                  ],
                ]),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: accent.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                child: Text(visitStatusLabel(l10n, visit.status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: accent)),
              ),
            ]),
            const SizedBox(height: 10),
            Divider(height: 1, color: colors.hairline),
            const SizedBox(height: 10),
            Row(children: [
              Icon(Icons.event_rounded, size: 15, color: colors.inkMuted),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  visit.scheduledAt == null ? '—' : leadWhen(context, visit.scheduledAt!),
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: colors.ink),
                ),
              ),
              const Icon(AppIcons.chevronForward, size: 18, color: AppPalette.gold400),
            ]),
          ]),
        ),
      ),
    );
  }
}
