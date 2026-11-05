import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../auth/presentation/cubit/staff_auth_cubit.dart';
import '../../domain/entities/maintenance_request.dart';
import '../cubit/maintenance_list_cubit.dart';
import '../maintenance_format.dart';
import '../../../dashboard/home_kit/filter_kit.dart';
import '../../../dashboard/home_kit/home_kit.dart';

// ── Color palette (mirrors Customer App) ─────────────────────────────────────

const _navyDeep  = Color(0xFF0B1726);
const _navyLight = Color(0xFF243F62);

const _activeGradient    = [_navyLight, _navyDeep];
const _activeAccent      = AppPalette.gold300;

const _inProgressGradient = [Color(0xFF0F3460), Color(0xFF061830)];
const _inProgressAccent   = Color(0xFF60A5FA);

const _closedGradient = [Color(0xFF1B5E3F), Color(0xFF0D3826)];
const _closedAccent   = Color(0xFF4ADE80);

// ── Filter key ────────────────────────────────────────────────────────────────

enum _FilterKey { all, active, closed }

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class MaintenanceListScreen extends StatefulWidget {
  const MaintenanceListScreen({super.key});

  @override
  State<MaintenanceListScreen> createState() => _MaintenanceListScreenState();
}

class _MaintenanceListScreenState extends State<MaintenanceListScreen> {
  _FilterKey _filter = _FilterKey.all;

  @override
  void initState() {
    super.initState();
    context.read<MaintenanceListCubit>().load();
  }

  List<MaintenanceRequest> _applyFilter(List<MaintenanceRequest> all) {
    return switch (_filter) {
      _FilterKey.all => all,
      _FilterKey.active => all
          .where((r) =>
              r.status == MaintenanceStatus.open ||
              r.status == MaintenanceStatus.assigned ||
              r.status == MaintenanceStatus.inProgress)
          .toList(),
      _FilterKey.closed => all
          .where((r) =>
              r.status == MaintenanceStatus.resolved ||
              r.status == MaintenanceStatus.closed)
          .toList(),
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n        = context.l10n;
    final cubit       = context.read<MaintenanceListCubit>();
    final displayName = context
        .watch<SessionCubit>()
        .state
        .sessionOrNull
        ?.displayName;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocBuilder<MaintenanceListCubit, MaintenanceListState>(
          builder: (context, state) {
            final ready = state.status == DataStatus.success;
            final all = state.requests;
            final visible = ready ? _applyFilter(all) : const <MaintenanceRequest>[];
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: ListView(
                key: const Key('maintenance-list'),
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.only(bottom: 96 + MediaQuery.paddingOf(context).bottom),
                children: [
                  _SupervisorHeader(
                    displayName: displayName,
                    l10n: l10n,
                    filtered: _filter != _FilterKey.all,
                    onFilter: ready ? () => _filters(all) : null,
                    onLogout: () async {
                      final ok = await showAdaptiveConfirm(
                        context,
                        title: l10n.actionLogout,
                        message: l10n.logoutConfirmMessage,
                        confirmLabel: l10n.actionLogout,
                        cancelLabel: l10n.actionCancel,
                        destructive: true,
                      );
                      if (ok && context.mounted) {
                        context.read<StaffAuthCubit>().logout();
                      }
                    },
                  ),
                  ...switch (state.status) {
                    DataStatus.initial || DataStatus.loading => [const SizedBox(height: 480, child: StaffListSkeleton())],
                    DataStatus.failure => [ErrorState(failure: state.failure, onRetry: cubit.load)],
                    DataStatus.empty => [
                        EmptyState(
                          icon: Icons.engineering_outlined,
                          title: l10n.supervisorNoAssignedTitle,
                          message: l10n.supervisorNoAssignedMessage,
                        ),
                      ],
                    DataStatus.success => [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                          child: _SummaryCard(requests: all, l10n: l10n),
                        ),
                        if (visible.isEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: AppSpacing.xl),
                            child: EmptyState(
                              icon: Icons.filter_list_off_rounded,
                              title: l10n.supervisorFilterEmptyTitle,
                              message: l10n.supervisorFilterEmptyMessage,
                            ),
                          )
                        else
                          for (final r in visible)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                              child: _RequestCard(request: r, l10n: l10n),
                            ),
                      ],
                  },
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  void _filters(List<MaintenanceRequest> all) {
    showFilterSheet(
      context,
      (_) => _FilterSheet(all: all, selected: _filter, onApply: (k) => setState(() => _filter = k)),
    );
  }
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.all, required this.selected, required this.onApply});
  final List<MaintenanceRequest> all;
  final _FilterKey selected;
  final ValueChanged<_FilterKey> onApply;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late _FilterKey _k = widget.selected;

  int _count(_FilterKey k) => switch (k) {
        _FilterKey.all => widget.all.length,
        _FilterKey.active => widget.all
            .where((r) => r.status == MaintenanceStatus.open || r.status == MaintenanceStatus.assigned || r.status == MaintenanceStatus.inProgress)
            .length,
        _FilterKey.closed => widget.all.where((r) => r.status == MaintenanceStatus.resolved || r.status == MaintenanceStatus.closed).length,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    String label(_FilterKey k) => switch (k) {
          _FilterKey.all => l10n.supervisorFilterAll,
          _FilterKey.active => l10n.supervisorFilterActive,
          _FilterKey.closed => l10n.supervisorFilterClosed,
        };
    return FilterSheet(
      title: l10n.maintenanceFilterTitle,
      active: _k == _FilterKey.all ? 0 : 1,
      onClear: () => setState(() => _k = _FilterKey.all),
      applyLabel: l10n.maintenanceFilterApply,
      onApply: () {
        widget.onApply(_k);
        Navigator.of(context).pop();
      },
      sections: [
        FilterSection(
          icon: Icons.flag_outlined,
          title: l10n.kcStatus,
          child: FilterRadioList<_FilterKey>(
            keyPrefix: 'maintenance-filter',
            selected: _k,
            onSelect: (v) => setState(() => _k = v),
            options: [for (final k in _FilterKey.values) FilterOption(k, label(k), sub: '${_count(k)}')],
          ),
        ),
      ],
    );
  }
}

// ── Supervisor header ─────────────────────────────────────────────────────────
//
// Single-row layout: [greeting + subtitle + role label] ← Expanded
//                    [notifications + logout]           ← end side
//
// Replaces AppNavHeader to eliminate the vertical split where actions floated
// at the top while the title sat far below.

class _SupervisorHeader extends StatelessWidget {
  const _SupervisorHeader({
    required this.displayName,
    required this.l10n,
    required this.onLogout,
    required this.filtered,
    this.onFilter,
  });

  final String?          displayName;
  final AppLocalizations l10n;
  final VoidCallback     onLogout;
  final bool             filtered;
  final VoidCallback?    onFilter;

  @override
  Widget build(BuildContext context) {
    final greeting = (displayName?.isNotEmpty == true)
        ? l10n.maintenanceWelcomeUser(displayName!)
        : l10n.maintenanceWelcomeFallback;
    return HomeListHero(
      title: greeting,
      subtitle: l10n.maintenanceSupervisorRole,
      actions: [
        if (onFilter != null)
          HomeHeroButton(
            key: const Key('maintenance-filters'),
            icon: Icons.tune_rounded,
            dot: filtered,
            tooltip: l10n.maintenanceFilterTitle,
            onTap: onFilter!,
          ),
        HomeHeroButton(icon: Icons.notifications_none_rounded, tooltip: l10n.accountNotifications, onTap: () => context.push('/notifications')),
        HomeHeroButton(icon: Icons.logout_rounded, tooltip: l10n.actionLogout, onTap: onLogout),
      ],
    );
  }
}

// ── Glass icon button (logout, etc.) ─────────────────────────────────────────

// ── Summary card ──────────────────────────────────────────────────────────────

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.requests, required this.l10n});
  final List<MaintenanceRequest> requests;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final activeCount = requests.where((r) => r.status == MaintenanceStatus.open || r.status == MaintenanceStatus.assigned).length;
    final inProgressCount = requests.where((r) => r.status == MaintenanceStatus.inProgress).length;
    final closedCount = requests.where((r) => r.status == MaintenanceStatus.resolved || r.status == MaintenanceStatus.closed).length;
    return HomeBand(figures: [
      HomeFigure(id: 'active', value: '$activeCount', label: l10n.supervisorFilterActive, hint: '${l10n.supervisorSummaryTotalLabel} ${requests.length}', warn: activeCount > 0),
      HomeFigure(id: 'progress', value: '$inProgressCount', label: l10n.supervisorStatInProgress, hint: ltr('${homePercent(inProgressCount, requests.length) ?? 0}%')),
      HomeFigure(id: 'closed', value: '$closedCount', label: l10n.supervisorFilterClosed, hint: ltr('${homePercent(closedCount, requests.length) ?? 0}%')),
    ]);
  }
}

// ── Card theme ────────────────────────────────────────────────────────────────

typedef _CardTheme = ({List<Color> gradient, Color accent, IconData icon});

_CardTheme _resolveCardTheme(MaintenanceStatus status) => switch (status) {
      MaintenanceStatus.open ||
      MaintenanceStatus.assigned =>
        (
          gradient: _activeGradient,
          accent: _activeAccent,
          icon: Icons.build_rounded,
        ),
      MaintenanceStatus.inProgress => (
        gradient: _inProgressGradient,
        accent: _inProgressAccent,
        icon: Icons.sync_rounded,
      ),
      MaintenanceStatus.resolved ||
      MaintenanceStatus.closed =>
        (
          gradient: _closedGradient,
          accent: _closedAccent,
          icon: Icons.check_circle_rounded,
        ),
      _ => (
        gradient: _activeGradient,
        accent: _activeAccent,
        icon: Icons.build_rounded,
      ),
    };

// ── Request card ──────────────────────────────────────────────────────────────

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request, required this.l10n});
  final MaintenanceRequest request;
  final AppLocalizations   l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme  = Theme.of(context);
    final lang   = Localizations.localeOf(context).languageCode;
    final isRtl  = context.read<LocaleCubit>().isRtl;

    final ct           = _resolveCardTheme(request.status);
    final category     = request.categoryName?.resolve(lang);
    final title        = (category?.isNotEmpty == true) ? category! : l10n.maintenanceFallbackTitle;
    final hasDesc      = request.description.trim().isNotEmpty;

    return GestureDetector(
      onTap: () => context.push('/maintenance/${request.id}', extra: request),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: colors.hairline),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Gradient strip ──────────────────────────────────────────
            SizedBox(
              height: 100,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: ct.gradient,
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                  ),
                  const IgnorePointer(child: _DotTexture()),
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                        height: 1,
                        color: ct.accent.withValues(alpha: 0.3)),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Row(
                      children: [
                        // Icon box
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: ct.accent.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                                color: ct.accent.withValues(alpha: 0.3)),
                          ),
                          child: Icon(ct.icon, color: ct.accent, size: 24),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        // Title + customer/unit
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 19,
                                  height: 1.1,
                                ),
                              ),
                              if (request.customerName != null ||
                                  request.unitCode != null) ...[
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.person_rounded,
                                      size: 12,
                                      color: Colors.white.withValues(alpha: 0.65),
                                    ),
                                    const SizedBox(width: 4),
                                    Flexible(
                                      child: Text(
                                        [
                                          if (request.customerName != null)
                                            request.customerName!,
                                          if (request.unitCode != null)
                                            request.unitCode!,
                                        ].join(' · '),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: Colors.white
                                              .withValues(alpha: 0.75),
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                        // Status pill
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: ct.accent.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                                color: ct.accent.withValues(alpha: 0.4)),
                          ),
                          child: Text(
                            maintenanceStatusLabel(context.l10n, request.status),
                            style: TextStyle(
                              color: ct.accent,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // ── White body ──────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Description
                  Text(
                    hasDesc ? request.description : l10n.supervisorNoDescription,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: hasDesc ? colors.ink : colors.inkMuted,
                      height: 1.55,
                      fontSize: 15,
                      fontStyle:
                          hasDesc ? FontStyle.normal : FontStyle.italic,
                    ),
                  ),

                  const SizedBox(height: AppSpacing.md),
                  Divider(height: 1, color: colors.hairline),
                  const SizedBox(height: AppSpacing.md),

                  // Date + priority
                  Row(
                    children: [
                      if (request.createdAt != null) ...[
                        Expanded(
                          child: _InfoCell(
                            icon: Icons.access_time_rounded,
                            label: context.l10n.maintenanceRequestDate,
                            value: DateFormatter.shortDate(
                              request.createdAt!,
                              languageCode: lang,
                            ),
                          ),
                        ),
                        Container(
                          width: 1,
                          height: 36,
                          color: colors.hairline,
                          margin: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.md),
                        ),
                      ],
                      Expanded(
                        child: _InfoCell(
                          icon: Icons.flag_rounded,
                          label: context.l10n.maintenancePriorityLabel,
                          value: maintenancePriorityLabel(context.l10n, request.priority),
                          accent: _priorityAccent(request.priority),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: AppSpacing.md),

                  // "عرض التفاصيل" row
                  _DetailsRow(
                    accent: ct.accent,
                    label: l10n.supervisorViewDetails,
                    isRtl: isRtl,
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

Color _priorityAccent(MaintenancePriority p) => switch (p) {
      MaintenancePriority.low    => const Color(0xFF94A3B8),
      MaintenancePriority.medium => AppPalette.gold400,
      MaintenancePriority.high   => const Color(0xFFF87171),
      MaintenancePriority.urgent => const Color(0xFFEF4444),
      _                          => const Color(0xFF94A3B8),
    };

// ── Info cell ─────────────────────────────────────────────────────────────────

class _InfoCell extends StatelessWidget {
  const _InfoCell({
    required this.icon,
    required this.label,
    required this.value,
    this.accent,
  });
  final IconData icon;
  final String   label;
  final String   value;
  final Color?   accent;

  @override
  Widget build(BuildContext context) {
    final colors    = context.appColors;
    final theme     = Theme.of(context);
    final iconColor = accent ?? colors.inkMuted;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 12, color: iconColor),
            const SizedBox(width: 4),
            Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: colors.inkMuted,
                fontSize: 12,
              ),
            ),
          ],
        ),
        const SizedBox(height: 3),
        Text(
          value,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: accent ?? colors.inkStrong,
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
        ),
      ],
    );
  }
}

// ── Details row ───────────────────────────────────────────────────────────────

class _DetailsRow extends StatelessWidget {
  const _DetailsRow({
    required this.accent,
    required this.label,
    required this.isRtl,
  });
  final Color  accent;
  final String label;
  final bool   isRtl;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme  = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accent.withValues(alpha: 0.22)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: 10),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(Icons.visibility_rounded, color: accent, size: 16),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                label,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(7),
              ),
              child: Icon(
                Icons.arrow_back_ios_new_rounded,
                color: accent,
                size: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Dot texture ───────────────────────────────────────────────────────────────

class _DotTexture extends StatelessWidget {
  const _DotTexture();

  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step  = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
