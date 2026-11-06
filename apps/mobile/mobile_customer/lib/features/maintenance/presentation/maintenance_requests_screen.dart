import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/entities/maintenance_request.dart';
import 'maintenance_format.dart';
import 'maintenance_requests_cubit.dart';


// ── Status palette ────────────────────────────────────────────────────────────




// ── Filter key enum ───────────────────────────────────────────────────────────

enum _FilterKey { open, inProgress, closed }

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance Requests Screen
// ─────────────────────────────────────────────────────────────────────────────

class MaintenanceRequestsScreen extends StatefulWidget {
  const MaintenanceRequestsScreen({super.key});

  @override
  State<MaintenanceRequestsScreen> createState() =>
      _MaintenanceRequestsScreenState();
}

class _MaintenanceRequestsScreenState
    extends State<MaintenanceRequestsScreen> {
  _FilterKey? _filter; // null = الكل

  @override
  void initState() {
    super.initState();
    context.read<MaintenanceRequestsCubit>().load();
  }

  Future<void> _openCreate() async {
    final created = await context.push<bool>('/account/maintenance/new');
    if (created == true && mounted) {
      context.read<MaintenanceRequestsCubit>().load();
    }
  }

  List<MaintenanceRequest> _applyFilter(List<MaintenanceRequest> all) {
    if (_filter == null) return all;
    return all.where((r) => switch (_filter!) {
          _FilterKey.open =>
            r.status == MaintenanceStatus.open ||
                r.status == MaintenanceStatus.assigned,
          _FilterKey.inProgress => r.status == MaintenanceStatus.inProgress,
          _FilterKey.closed =>
            r.status == MaintenanceStatus.resolved ||
                r.status == MaintenanceStatus.closed,
        }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state;
    final displayName =
        session.sessionOrNull?.displayName ?? session.sessionOrNull?.email;

    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: Column(
        children: [
          // ── Header (needs count from state) ────────────────────────────
          BlocBuilder<MaintenanceRequestsCubit, MaintenanceRequestsState>(
            buildWhen: (a, b) =>
                (a.data?.length ?? -1) != (b.data?.length ?? -1) ||
                a.status != b.status,
            builder: (context, state) => _MaintHeader(
              displayName: displayName,
              requestCount:
                  state.status == DataStatus.success ? state.data!.length : null,
              onNewRequest: _openCreate,
              l10n: l10n,
            ),
          ),

          // ── Filter chips ────────────────────────────────────────────────
          BlocBuilder<MaintenanceRequestsCubit, MaintenanceRequestsState>(
            builder: (context, state) {
              if (state.status != DataStatus.success) {
                return const SizedBox.shrink();
              }
              final all = state.data!;
              final openCount = all
                  .where((r) =>
                      r.status == MaintenanceStatus.open ||
                      r.status == MaintenanceStatus.assigned)
                  .length;
              final inProgressCount = all
                  .where((r) => r.status == MaintenanceStatus.inProgress)
                  .length;
              final closedCount = all
                  .where((r) =>
                      r.status == MaintenanceStatus.resolved ||
                      r.status == MaintenanceStatus.closed)
                  .length;
              HomePill pill(String? key, String label, int count, {Color? dot}) => HomePill(
                    id: key ?? 'all',
                    label: label,
                    count: count,
                    dot: dot,
                    selected: _filter?.name == key,
                    onTap: () => setState(() {
                      _filter = key == null ? null : _FilterKey.values.firstWhere((f) => f.name == key);
                    }),
                  );
              return Padding(
                padding: const EdgeInsets.only(top: 14),
                child: HomePills(pills: [
                  pill(null, context.l10n.leadsFilterAll, all.length),
                  pill(_FilterKey.open.name, context.l10n.maintenanceStatusOpen, openCount, dot: catalogReserved),
                  pill(_FilterKey.inProgress.name, context.l10n.maintenanceStatusInProgress, inProgressCount, dot: const Color(0xFF3B82F6)),
                  pill(_FilterKey.closed.name, context.l10n.maintenanceStatusClosed, closedCount, dot: catalogAvailable),
                ]),
              );
            },
          ),

          // ── List ────────────────────────────────────────────────────────
          Expanded(
            child: BlocBuilder<MaintenanceRequestsCubit,
                MaintenanceRequestsState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const Center(child: CircularProgressIndicator());
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () =>
                          context.read<MaintenanceRequestsCubit>().load(),
                    );
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.build_outlined,
                      title: l10n.maintenanceEmptyTitle,
                      message: l10n.maintenanceEmptyMessage,
                      action: AppButton(
                        label: l10n.maintenanceNewRequest,
                        icon: Icons.add_rounded,
                        variant: AppButtonVariant.gold,
                        onPressed: _openCreate,
                      ),
                    );
                  case DataStatus.success:
                    final all = state.data!;
                    final visible = _applyFilter(all);
                    return RefreshIndicator(
                      onRefresh: () =>
                          context.read<MaintenanceRequestsCubit>().load(),
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          14,
                          AppSpacing.md,
                          110 + MediaQuery.of(context).padding.bottom,
                        ),
                        itemCount: visible.length + 1, // +1 for summary
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          if (i == 0) {
                            return _MaintSummary(requests: all, l10n: l10n);
                          }
                          return _RequestCard(request: visible[i - 1]);
                        },
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

class _MaintHeader extends StatelessWidget {
  const _MaintHeader({
    required this.displayName,
    required this.requestCount,
    required this.onNewRequest,
    required this.l10n,
  });

  final String? displayName;
  final int? requestCount;
  final VoidCallback onNewRequest;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return AppNavHeader(
      title: l10n.accountMaintenance,
      subtitle: requestCount != null && requestCount! > 0 ? '${l10n.serviceRequests} · $requestCount' : l10n.serviceRequests,
      compact: true,
      leadingAction: GestureDetector(
        onTap: () => context.push('/account/profile'),
        child: _GoldRingAvatar(name: displayName),
      ),
      actions: [NavHeaderButton(label: l10n.leadTabNew, onTap: onNewRequest)],
    );
  }
}

// ── Summary card ──────────────────────────────────────────────────────────────

class _MaintSummary extends StatelessWidget {
  const _MaintSummary({required this.requests, required this.l10n});
  final List<MaintenanceRequest> requests;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final open = requests.where((r) => r.status == MaintenanceStatus.open || r.status == MaintenanceStatus.assigned).length;
    final progress = requests.where((r) => r.status == MaintenanceStatus.inProgress).length;
    final done = requests.where((r) => r.status == MaintenanceStatus.resolved || r.status == MaintenanceStatus.closed).length;
    return HomeBand(figures: [
      HomeFigure(id: 'open', value: '$open', label: l10n.maintenanceStatusOpen, hint: l10n.serviceRequests, warn: open > 0),
      HomeFigure(id: 'progress', value: '$progress', label: l10n.maintenanceStatusInProgress, hint: l10n.serviceRequests),
      HomeFigure(id: 'done', value: '$done', label: l10n.maintenanceStatusClosed, hint: l10n.serviceRequests),
    ]);
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request});
  final MaintenanceRequest request;

  (Color, IconData) _look() => switch (request.status) {
        MaintenanceStatus.inProgress => (const Color(0xFF3B82F6), Icons.sync_rounded),
        MaintenanceStatus.resolved || MaintenanceStatus.closed => (catalogAvailable, Icons.check_circle_rounded),
        _ => (catalogReserved, Icons.build_rounded),
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final (accent, icon) = _look();
    final category = request.categoryName?.resolve(lang);
    final title = (category?.isNotEmpty == true) ? category! : l10n.accountMaintenance;
    final hasDescription = request.description.trim().isNotEmpty;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: () => context.push('/account/maintenance/${request.id}', extra: request),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: homeCard(context, radius: 22),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(15)),
                child: Icon(icon, color: AppPalette.gold300, size: 22),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(16, colors.inkStrong)),
                  if (request.unitCode?.isNotEmpty == true)
                    Row(children: [
                      Icon(AppIcons.property, size: 13, color: colors.inkMuted),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(ltr(request.unitCode!), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
                      ),
                    ]),
                ]),
              ),
              const SizedBox(width: 8),
              CatalogBadge.status(maintenanceStatusLabel(l10n, request.status), accent),
            ]),
            const SizedBox(height: 10),
            Text(
              hasDescription ? request.description : l10n.supervisorNoDescription,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 13.5, height: 1.5, color: hasDescription ? colors.ink : colors.inkMuted),
            ),
            const SizedBox(height: 10),
            Row(children: [
              if (request.createdAt != null)
                _Chip(Icons.calendar_today_rounded, DateFormatter.shortDate(request.createdAt!, languageCode: lang)),
              const SizedBox(width: 6),
              _Chip(Icons.flag_rounded, maintenancePriorityLabel(l10n, request.priority), color: _priorityAccent(request.priority, dark)),
              const Spacer(),
              Icon(Icons.chevron_right_rounded, size: 22, color: colors.inkStrong),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.icon, this.text, {this.color});
  final IconData icon;
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(color: homeTint(context), border: Border.all(color: homeTintBorder(context)), borderRadius: BorderRadius.circular(99)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 13, color: color ?? AppPalette.gold500),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: context.appColors.inkStrong)),
        ]),
      );
}

Color _priorityAccent(MaintenancePriority p, bool dark) => switch (p) {
      MaintenancePriority.medium =>
        dark ? AppPalette.gold400 : const Color(0xFF9A6F1E),
      MaintenancePriority.high =>
        dark ? const Color(0xFFF87171) : const Color(0xFFB91C1C),
      MaintenancePriority.urgent =>
        dark ? const Color(0xFFEF4444) : const Color(0xFF991B1B),
      _ => const Color(0xFF94A3B8),
    };

// ── "عرض التفاصيل" row ────────────────────────────────────────────────────────

class _GoldRingAvatar extends StatelessWidget {
  const _GoldRingAvatar({required this.name});
  final String? name;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.75),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.26),
            blurRadius: 14,
            spreadRadius: 1,
          ),
        ],
      ),
      child: GradientAvatar(name: name, size: 48),
    );
  }
}

// ── Filter row ────────────────────────────────────────────────────────────────

