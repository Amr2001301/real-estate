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
                        const SizedBox(height: 2),
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

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request, required this.l10n});
  final MaintenanceRequest request;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final r = request;
    final category = r.categoryName?.resolve(lang);
    final late = r.dueAt != null && r.dueAt!.isBefore(DateTime.now()) && r.status != MaintenanceStatus.resolved && r.status != MaintenanceStatus.closed;
    final tone = switch (maintenanceStatusTone(r.status)) {
      BadgeTone.success => colors.success,
      BadgeTone.info => colors.info,
      _ => colors.inkMuted,
    };
    return DvEntityCard(
      inkKey: Key('maintenance-${r.id}'),
      title: (category ?? '').isNotEmpty ? category! : l10n.maintenanceFallbackTitle,
      icon: Icons.build_rounded,
      subtitle: [if ((r.customerName ?? '').isNotEmpty) r.customerName!, if ((r.unitCode ?? '').isNotEmpty) ltr(r.unitCode!)].join(' · '),
      status: maintenanceStatusLabel(l10n, r.status),
      statusColor: tone,
      footIcon: late ? Icons.schedule_rounded : Icons.flag_outlined,
      footColor: late ? colors.error : null,
      footText: r.description.trim().isEmpty ? l10n.supervisorNoDescription : r.description.trim(),
      footSub: [
        if (r.priority != MaintenancePriority.unknown) maintenancePriorityLabel(l10n, r.priority),
        if (r.dueAt != null) DateFormatter.mediumDate(r.dueAt!, languageCode: lang),
      ].join(' · '),
      onTap: () => context.push('/maintenance/${r.id}', extra: r),
    );
  }
}
