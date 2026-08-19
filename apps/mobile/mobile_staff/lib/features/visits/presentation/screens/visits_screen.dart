import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../../common/visit_status_label.dart';
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

  @override
  Widget build(BuildContext context) {
    final l10n     = context.l10n;
    final cubit    = context.read<VisitsCubit>();
    final isRtl    = Directionality.of(context) == TextDirection.rtl;
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          BlocBuilder<VisitsCubit, VisitsListState>(
            buildWhen: (a, b) => a.today != b.today,
            builder: (context, state) => AppNavHeader(
              title: l10n.navVisits,
              leadingAction: NavHeaderAction(
                icon: isRtl
                    ? Icons.arrow_forward_ios_rounded
                    : Icons.arrow_back_ios_new_rounded,
                onTap: () => context.pop(),
              ),
              actions: [
                NavHeaderAction(
                  icon: state.today
                      ? Icons.today_rounded
                      : Icons.today_outlined,
                  tooltip: l10n.visitsToday,
                  onTap: cubit.toggleToday,
                ),
              ],
            ),
          ),
          _StatusFilter(),
          Expanded(
            child: BlocBuilder<VisitsCubit, VisitsListState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.event_busy_outlined,
                      title: l10n.visitsEmptyTitle,
                      message: l10n.visitsEmptyMessage,
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        controller: _scrollCtrl,
                        padding: EdgeInsets.fromLTRB(
                            AppSpacing.md, AppSpacing.sm,
                            AppSpacing.md, bottomPad + 100),
                        itemCount: state.visits.length + (state.isLoadingMore ? 1 : 0),
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) {
                          if (i == state.visits.length) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                              child: Center(child: CircularProgressIndicator()),
                            );
                          }
                          return _VisitTile(visit: state.visits[i]);
                        },
                      ),
                    );
                }
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add_rounded),
        label: Text(l10n.visitNew),
      ),
    );
  }
}

// ── Status filter ─────────────────────────────────────────────────────────────

class _StatusFilter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final cubit  = context.read<VisitsCubit>();
    final colors = context.appColors;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(
          bottom: BorderSide(color: colors.hairline, width: 0.5),
        ),
      ),
      child: BlocBuilder<VisitsCubit, VisitsListState>(
        buildWhen: (a, b) => a.statusFilter != b.statusFilter,
        builder: (context, state) => SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg, vertical: 10),
          child: Row(
            children: [
              _FilterChip(
                label: l10n.leadsFilterAll,
                active: state.statusFilter == null,
                onTap: () => cubit.setStatus(null),
              ),
              for (final s in kVisitStatuses) ...[
                const SizedBox(width: AppSpacing.xs),
                _FilterChip(
                  label: visitStatusLabel(l10n, s),
                  active: state.statusFilter == s,
                  onTap: () => cubit.setStatus(s),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Filter chip ───────────────────────────────────────────────────────────────

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
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm + 4, vertical: 8),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(
            color: active ? colors.brandNavy : colors.hairline,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: active ? FontWeight.w700 : FontWeight.w600,
            color: active ? Colors.white : colors.inkStrong,
            height: 1.2,
          ),
        ),
      ),
    );
  }
}

// ── Visit tile ────────────────────────────────────────────────────────────────

class _VisitTile extends StatelessWidget {
  const _VisitTile({required this.visit});
  final Visit visit;

  Color _toneColor(BadgeTone tone, AppColorsExt c) => switch (tone) {
        BadgeTone.success => c.success,
        BadgeTone.warning => c.warning,
        BadgeTone.error   => c.error,
        BadgeTone.info    => c.info,
        BadgeTone.gold    => c.brandGold,
        _                 => c.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final l10n        = context.l10n;
    final colors      = context.appColors;
    final lang        = Localizations.localeOf(context).languageCode;
    final tone        = visitStatusTone(visit.status);
    final statusColor = _toneColor(tone, colors);

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
            onTap: () => context.push('/visits/${visit.id}', extra: visit),
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: colors.hairline, width: 0.5),
                borderRadius: AppRadii.card,
              ),
              child: Stack(
                children: [
                  PositionedDirectional(
                    top: 0, bottom: 0, start: 0,
                    child: Container(width: 4, color: statusColor),
                  ),
                  Padding(
                    padding: const EdgeInsetsDirectional.fromSTEB(
                      AppSpacing.md, AppSpacing.md,
                      AppSpacing.md, AppSpacing.md,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                visit.clientName ??
                                    visit.projectName ??
                                    l10n.navVisits,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: colors.inkStrong,
                                  height: 1.2,
                                ),
                              ),
                              if (visit.scheduledAt != null) ...[
                                const SizedBox(height: 3),
                                Row(children: [
                                  Icon(Icons.schedule_rounded,
                                      size: 12, color: colors.inkMuted),
                                  const SizedBox(width: 3),
                                  Text(
                                    DateFormatter.shortDate(
                                        visit.scheduledAt!,
                                        languageCode: lang),
                                    style: TextStyle(
                                        fontSize: 12,
                                        color: colors.inkMuted,
                                        height: 1.3),
                                  ),
                                  if (visit.unitCode != null) ...[
                                    Text(' · ',
                                        style: TextStyle(
                                            fontSize: 12,
                                            color: colors.inkMuted)),
                                    Text(visit.unitCode!,
                                        style: TextStyle(
                                            fontSize: 12,
                                            color: colors.inkMuted)),
                                  ],
                                ]),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        StatusBadge(
                          label: visitStatusLabel(l10n, visit.status),
                          tone: tone,
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
