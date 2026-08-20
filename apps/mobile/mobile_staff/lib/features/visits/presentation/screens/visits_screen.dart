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
    final isRtl    = context.read<LocaleCubit>().isRtl;
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          BlocBuilder<VisitsCubit, VisitsListState>(
            buildWhen: (a, b) => a.today != b.today,
            builder: (context, state) => AppNavHeader(
              title: l10n.navVisits,
              leadingAction: NavHeaderAction(
                icon: Icons.arrow_back_ios_new_rounded,
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
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm + 4, vertical: 8),
        decoration: BoxDecoration(
          gradient: active
              ? const LinearGradient(
                  colors: [Color(0xFFAA8528), AppPalette.gold400],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: active ? null : colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(
            color: active ? AppPalette.gold500 : colors.hairline,
            width: active ? 0.8 : 1.0,
          ),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: AppPalette.gold400.withValues(alpha: 0.28),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: active ? FontWeight.w700 : FontWeight.w600,
            color: active ? AppPalette.navy : colors.inkStrong,
            height: 1.2,
          ),
        ),
      ),
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
    BadgeTone.error   => c.error,
    BadgeTone.info    => c.info,
    BadgeTone.gold    => c.brandGold,
    _                 => c.inkMuted,
  };

  static IconData _statusIcon(String status) => switch (status) {
    'SCHEDULED'  => Icons.event_available_rounded,
    'COMPLETED'  => Icons.check_circle_outline_rounded,
    'CANCELLED'  => Icons.event_busy_rounded,
    'NO_SHOW'    => Icons.person_off_outlined,
    _            => Icons.event_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final l10n    = context.l10n;
    final colors  = context.appColors;
    final lang    = Localizations.localeOf(context).languageCode;
    final isRtl   = context.read<LocaleCubit>().isRtl;
    final tone    = visitStatusTone(visit.status);
    final accent  = _toneColor(tone, colors);
    final hasDate = visit.scheduledAt != null;
    final hasUnit = visit.unitCode != null;

    return GestureDetector(
      onTapDown:   (_) => setState(() => _pressed = true),
      onTapUp:     (_) => setState(() => _pressed = false),
      onTapCancel: ()  => setState(() => _pressed = false),
      onTap: ()        => context.push('/visits/${visit.id}', extra: visit),
      child: AnimatedScale(
        scale:    _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve:    Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color:        colors.surface,
            borderRadius: AppRadii.card,
            border:       Border.all(color: accent.withValues(alpha: 0.14), width: 0.8),
            boxShadow: [
              BoxShadow(
                color:      accent.withValues(alpha: 0.10),
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
            mainAxisSize:         MainAxisSize.min,
            crossAxisAlignment:   CrossAxisAlignment.stretch,
            children: [
              // ── Top gradient accent strip ──────────────────────────────
              Container(
                height: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin:  isRtl ? Alignment.centerRight : Alignment.centerLeft,
                    end:    isRtl ? Alignment.centerLeft  : Alignment.centerRight,
                    colors: [accent, accent.withValues(alpha: 0.0)],
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
                    // ── Icon + name + badge row ────────────────────────
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Container(
                          width:  42,
                          height: 42,
                          decoration: BoxDecoration(
                            color:  accent.withValues(alpha: 0.10),
                            shape:  BoxShape.circle,
                            border: Border.all(color: accent.withValues(alpha: 0.24)),
                          ),
                          child: Icon(_statusIcon(visit.status), color: accent, size: 20),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                visit.clientName ?? visit.projectName ?? l10n.navVisits,
                                maxLines:  1,
                                overflow:  TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize:   15,
                                  fontWeight: FontWeight.w700,
                                  color:      colors.inkStrong,
                                  height:     1.2,
                                ),
                              ),
                              if (visit.clientName != null && visit.projectName != null) ...[
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    Icon(Icons.apartment_outlined, size: 12, color: colors.inkMuted),
                                    const SizedBox(width: 3),
                                    Expanded(
                                      child: Text(
                                        visit.projectName!,
                                        maxLines:  1,
                                        overflow:  TextOverflow.ellipsis,
                                        style: TextStyle(fontSize: 12, color: colors.inkMuted, height: 1.3),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        StatusBadge(label: visitStatusLabel(l10n, visit.status), tone: tone),
                      ],
                    ),
                    // ── Info chips + disclosure arrow ─────────────────
                    if (hasDate || hasUnit) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Container(height: 0.5, color: colors.hairline),
                      const SizedBox(height: AppSpacing.xs),
                      Row(
                        children: [
                          if (hasDate)
                            _InfoChip(
                              icon:  Icons.schedule_rounded,
                              label: DateFormatter.shortDate(visit.scheduledAt!, languageCode: lang),
                              color: colors.brandNavy,
                            ),
                          if (hasDate && hasUnit) const SizedBox(width: AppSpacing.xs),
                          if (hasUnit)
                            _InfoChip(
                              icon:  Icons.apartment_outlined,
                              label: visit.unitCode!,
                              color: colors.brandGold,
                            ),
                          const Spacer(),
                          Transform.flip(
                            flipX: false,
                            child: Icon(
                              Icons.arrow_forward_ios_rounded,
                              size:  12,
                              color: colors.inkMuted,
                            ),
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
