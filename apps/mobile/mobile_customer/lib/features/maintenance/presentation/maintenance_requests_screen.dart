import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/entities/maintenance_request.dart';
import 'maintenance_format.dart';
import 'maintenance_requests_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ── Status palette ────────────────────────────────────────────────────────────

const _openGradient = [_navyLight, _navyDeep];
const _openAccent = AppPalette.gold300;

const _inProgressGradient = [Color(0xFF0F3460), Color(0xFF061830)];
const _inProgressAccent = Color(0xFF60A5FA);

const _closedGradient = [Color(0xFF1B5E3F), Color(0xFF0D3826)];
const _closedAccent = Color(0xFF4ADE80);

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
              return _FilterRow(
                selected: _filter?.name,
                items: [
                  _FilterItem(
                    key: null,
                    label: 'الكل',
                    dotColor: null,
                    activeGradient: _openGradient,
                    count: all.length,
                  ),
                  _FilterItem(
                    key: _FilterKey.open.name,
                    label: 'مفتوح',
                    dotColor: _openAccent,
                    activeGradient: _openGradient,
                    count: openCount,
                  ),
                  _FilterItem(
                    key: _FilterKey.inProgress.name,
                    label: 'قيد التنفيذ',
                    dotColor: _inProgressAccent,
                    activeGradient: _inProgressGradient,
                    count: inProgressCount,
                  ),
                  _FilterItem(
                    key: _FilterKey.closed.name,
                    label: 'مغلق',
                    dotColor: _closedAccent,
                    activeGradient: _closedGradient,
                    count: closedCount,
                  ),
                ],
                onSelect: (k) => setState(() {
                  _filter = k == null
                      ? null
                      : _FilterKey.values.firstWhere((f) => f.name == k);
                }),
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
                          AppSpacing.lg,
                          AppSpacing.md,
                          AppSpacing.lg,
                          96 + MediaQuery.of(context).padding.bottom,
                        ),
                        itemCount: visible.length + 1, // +1 for summary
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.md),
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
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [_navyLight, _navyCard, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(28),
            bottomRight: Radius.circular(28),
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
            const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 180,
                height: 130,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.09),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 48,
              right: 48,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.0),
                      AppPalette.gold400.withValues(alpha: 0.5),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                topInset + AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  GestureDetector(
                    onTap: () => context.push('/account/profile'),
                    child: _GoldRingAvatar(name: displayName),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'طلبات الخدمة',
                          style: theme.textTheme.labelSmall?.copyWith(
                            fontSize: 12,
                            color: AppPalette.gold300,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.4,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Text(
                              l10n.accountMaintenance,
                              style: theme.textTheme.titleLarge?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                height: 1.1,
                              ),
                            ),
                            if (requestCount != null && requestCount! > 0) ...[
                              const SizedBox(width: AppSpacing.sm),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                    color:
                                        Colors.white.withValues(alpha: 0.2),
                                  ),
                                ),
                                child: Text(
                                  '$requestCount',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  GestureDetector(
                    onTap: onNewRequest,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm,
                      ),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFC8A24B), AppPalette.gold500],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: [
                          BoxShadow(
                            color: AppPalette.gold400.withValues(alpha: 0.35),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.add_rounded, color: _navyDeep, size: 16),
                          SizedBox(width: 4),
                          Text(
                            'جديد',
                            style: TextStyle(
                              color: _navyDeep,
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
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

// ── Summary card ──────────────────────────────────────────────────────────────

class _MaintSummary extends StatelessWidget {
  const _MaintSummary({required this.requests, required this.l10n});
  final List<MaintenanceRequest> requests;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final openCount = requests
        .where((r) =>
            r.status == MaintenanceStatus.open ||
            r.status == MaintenanceStatus.assigned)
        .length;
    final inProgressCount =
        requests.where((r) => r.status == MaintenanceStatus.inProgress).length;
    final closedCount = requests
        .where((r) =>
            r.status == MaintenanceStatus.resolved ||
            r.status == MaintenanceStatus.closed)
        .length;

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_navyLight, _navyDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: _navyDeep.withValues(alpha: 0.25),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.08),
            blurRadius: 24,
            spreadRadius: 2,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'إجمالي الطلبات',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.6),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.3,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${requests.length}',
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: AppPalette.gold300,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.15),
                        ),
                      ),
                      child: Text(
                        '${requests.length} ${l10n.accountMaintenance}',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Container(height: 1, color: Colors.white.withValues(alpha: 0.12)),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: _SummaryCell(
                        value: '$openCount',
                        label: 'مفتوحة',
                        accent: _openAccent,
                        theme: theme,
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 40,
                      color: Colors.white.withValues(alpha: 0.15),
                    ),
                    Expanded(
                      child: _SummaryCell(
                        value: '$inProgressCount',
                        label: 'قيد التنفيذ',
                        accent: _inProgressAccent,
                        theme: theme,
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 40,
                      color: Colors.white.withValues(alpha: 0.15),
                    ),
                    Expanded(
                      child: _SummaryCell(
                        value: '$closedCount',
                        label: 'مغلقة',
                        accent: _closedAccent,
                        theme: theme,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCell extends StatelessWidget {
  const _SummaryCell({
    required this.value,
    required this.label,
    required this.accent,
    required this.theme,
  });
  final String value;
  final String label;
  final Color accent;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: theme.textTheme.headlineSmall?.copyWith(
            color: accent,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.65),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

// ── Card theme config ─────────────────────────────────────────────────────────

class _CardTheme {
  const _CardTheme({
    required this.gradient,
    required this.accent,
    required this.icon,
  });
  final List<Color> gradient;
  final Color accent;
  final IconData icon;
}

// ── Request card ──────────────────────────────────────────────────────────────

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request});
  final MaintenanceRequest request;

  _CardTheme _cardTheme() => switch (request.status) {
        MaintenanceStatus.open ||
        MaintenanceStatus.assigned =>
          const _CardTheme(
            gradient: _openGradient,
            accent: _openAccent,
            icon: Icons.build_rounded,
          ),
        MaintenanceStatus.inProgress => const _CardTheme(
            gradient: _inProgressGradient,
            accent: _inProgressAccent,
            icon: Icons.sync_rounded,
          ),
        MaintenanceStatus.resolved ||
        MaintenanceStatus.closed =>
          const _CardTheme(
            gradient: _closedGradient,
            accent: _closedAccent,
            icon: Icons.check_circle_rounded,
          ),
        _ => const _CardTheme(
            gradient: _openGradient,
            accent: _openAccent,
            icon: Icons.build_rounded,
          ),
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    final ct = _cardTheme();
    final category = request.categoryName?.resolve(lang);
    final title =
        (category?.isNotEmpty == true) ? category! : l10n.accountMaintenance;
    final hasDescription = request.description.trim().isNotEmpty;

    return GestureDetector(
      onTap: () =>
          context.push('/account/maintenance/${request.id}', extra: request),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.07),
              blurRadius: 20,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Gradient strip (mirrors installments card) ─────────────
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
                      color: ct.accent.withValues(alpha: 0.3),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Row(
                      children: [
                        // Status-accented icon box
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: ct.accent.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: ct.accent.withValues(alpha: 0.3),
                            ),
                          ),
                          child: Icon(ct.icon, color: ct.accent, size: 24),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        // Category title + unit code
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
                                  fontSize: 20,
                                  height: 1.0,
                                ),
                              ),
                              if (request.unitCode?.isNotEmpty == true) ...[
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      AppIcons.property,
                                      size: 13,
                                      color:
                                          Colors.white.withValues(alpha: 0.65),
                                    ),
                                    const SizedBox(width: 4),
                                    Flexible(
                                      child: Text(
                                        request.unitCode!,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: Colors.white
                                              .withValues(alpha: 0.75),
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: 0.2,
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
                              color: ct.accent.withValues(alpha: 0.4),
                            ),
                          ),
                          child: Text(
                            maintenanceStatusLabel(l10n, request.status),
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

            // ── White body ─────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.md,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Description
                  Text(
                    hasDescription ? request.description : 'لا يوجد وصف',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: hasDescription ? colors.ink : colors.inkMuted,
                      height: 1.55,
                      fontSize: 15,
                      fontStyle: hasDescription
                          ? FontStyle.normal
                          : FontStyle.italic,
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
                            icon: AppIcons.calendar,
                            label: 'تاريخ الطلب',
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
                          label: 'الأولوية',
                          value: maintenancePriorityLabel(l10n, request.priority),
                          accent: _priorityAccent(request.priority),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: AppSpacing.md),

                  // "عرض التفاصيل" action row
                  _DetailsRow(accent: ct.accent),
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
      MaintenancePriority.low => const Color(0xFF94A3B8),
      MaintenancePriority.medium => AppPalette.gold400,
      MaintenancePriority.high => const Color(0xFFF87171),
      MaintenancePriority.urgent => const Color(0xFFEF4444),
      _ => const Color(0xFF94A3B8),
    };

// ── "عرض التفاصيل" row ────────────────────────────────────────────────────────

class _DetailsRow extends StatelessWidget {
  const _DetailsRow({required this.accent});
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accent.withValues(alpha: 0.22), width: 1),
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
                'عرض التفاصيل',
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
              child: Icon(Icons.arrow_forward_ios_rounded, color: accent, size: 13),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Info cell (date / priority) ───────────────────────────────────────────────

class _InfoCell extends StatelessWidget {
  const _InfoCell({
    required this.icon,
    required this.label,
    required this.value,
    this.accent,
  });
  final IconData icon;
  final String label;
  final String value;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final iconColor = accent ?? colors.inkMuted;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 13, color: iconColor),
            const SizedBox(width: 4),
            Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: colors.inkMuted,
                fontSize: 13,
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
            fontSize: 15,
          ),
        ),
      ],
    );
  }
}

// ── Gold ring avatar ──────────────────────────────────────────────────────────

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

class _FilterItem {
  const _FilterItem({
    required this.key,
    required this.label,
    required this.dotColor,
    required this.activeGradient,
    required this.count,
  });
  final String? key;
  final String label;
  final Color? dotColor;
  final List<Color> activeGradient;
  final int count;
}

class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.items,
    required this.selected,
    required this.onSelect,
  });
  final List<_FilterItem> items;
  final String? selected;
  final void Function(String?) onSelect;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return SizedBox(
      height: 62,
      child: Padding(
        padding: const EdgeInsets.only(top: 9.0),
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg, vertical: 8),
          itemCount: items.length,
          separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
          itemBuilder: (context, i) {
            final item = items[i];
            final active = item.key == selected;
            return GestureDetector(
              onTap: () => onSelect(item.key),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  gradient: active
                      ? LinearGradient(
                          colors: item.activeGradient,
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                  color: active ? null : colors.surface,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: active
                        ? Colors.transparent
                        : item.dotColor != null
                            ? item.dotColor!.withValues(alpha: 0.3)
                            : colors.hairline.withValues(alpha: 0.6),
                    width: 1.5,
                  ),
                  boxShadow: active
                      ? [
                          BoxShadow(
                            color: item.activeGradient.last
                                .withValues(alpha: 0.3),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ]
                      : [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (item.dotColor != null) ...[
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: active
                              ? item.dotColor!.withValues(alpha: 0.9)
                              : item.dotColor!.withValues(alpha: 0.7),
                          shape: BoxShape.circle,
                          boxShadow: active
                              ? [
                                  BoxShadow(
                                    color:
                                        item.dotColor!.withValues(alpha: 0.5),
                                    blurRadius: 4,
                                    spreadRadius: 1,
                                  ),
                                ]
                              : null,
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      item.label,
                      style: TextStyle(
                        color: active ? Colors.white : colors.inkStrong,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: active
                            ? Colors.white.withValues(alpha: 0.18)
                            : item.dotColor != null
                                ? item.dotColor!.withValues(alpha: 0.14)
                                : colors.hairline.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '${item.count}',
                        style: TextStyle(
                          color: active
                              ? Colors.white
                              : item.dotColor ?? colors.inkMuted,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          height: 1.2,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
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
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
