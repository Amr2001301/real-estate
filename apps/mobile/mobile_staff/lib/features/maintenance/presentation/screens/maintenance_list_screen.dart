import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../auth/presentation/cubit/staff_auth_cubit.dart';
import '../../../notifications/presentation/widgets/notifications_bell.dart';
import '../../domain/entities/maintenance_request.dart';
import '../cubit/maintenance_list_cubit.dart';
import '../maintenance_format.dart';

// ── Color palette (mirrors Customer App) ─────────────────────────────────────

const _navyDeep  = Color(0xFF0B1726);
const _navyCard  = Color(0xFF1A3352);
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

    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────────
          _SupervisorHeader(
            displayName: displayName,
            l10n: l10n,
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

          // ── Body ────────────────────────────────────────────────────────
          Expanded(
            child: BlocBuilder<MaintenanceListCubit, MaintenanceListState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();

                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);

                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.engineering_outlined,
                      title: l10n.supervisorNoAssignedTitle,
                      message: l10n.supervisorNoAssignedMessage,
                    );

                  case DataStatus.success:
                    final all     = state.requests;
                    final visible = _applyFilter(all);
                    return Column(
                      children: [
                        // Fixed filter row
                        _FilterRow(
                          all: all,
                          selected: _filter,
                          onSelect: (k) => setState(() => _filter = k),
                          l10n: l10n,
                        ),
                        // Scrollable list (summary card + request cards)
                        Expanded(
                          child: RefreshIndicator(
                            onRefresh: cubit.load,
                            child: visible.isEmpty
                                ? ListView(
                                    padding: const EdgeInsets.all(AppSpacing.lg),
                                    children: [
                                      _SummaryCard(requests: all, l10n: l10n),
                                      const SizedBox(height: AppSpacing.xl),
                                      EmptyState(
                                        icon: Icons.filter_list_off_rounded,
                                        title: l10n.supervisorFilterEmptyTitle,
                                        message: l10n.supervisorFilterEmptyMessage,
                                      ),
                                    ],
                                  )
                                : ListView.separated(
                                    padding: EdgeInsets.fromLTRB(
                                      AppSpacing.lg,
                                      AppSpacing.md,
                                      AppSpacing.lg,
                                      96 + MediaQuery.of(context).padding.bottom,
                                    ),
                                    itemCount: visible.length + 1,
                                    separatorBuilder: (_, _) =>
                                        const SizedBox(height: AppSpacing.md),
                                    itemBuilder: (context, i) {
                                      if (i == 0) {
                                        return _SummaryCard(requests: all, l10n: l10n);
                                      }
                                      return _RequestCard(
                                        request: visible[i - 1],
                                        l10n: l10n,
                                      );
                                    },
                                  ),
                          ),
                        ),
                      ],
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
  });

  final String?          displayName;
  final AppLocalizations l10n;
  final VoidCallback     onLogout;

  @override
  Widget build(BuildContext context) {
    final theme    = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    final greeting = (displayName?.isNotEmpty == true)
        ? l10n.maintenanceWelcomeUser(displayName!)
        : l10n.maintenanceWelcomeFallback;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light
          .copyWith(statusBarColor: Colors.transparent),
      child: Container(
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
            // Dot texture
            const Positioned.fill(
                child: IgnorePointer(child: _DotTexture())),
            // Gold radial bloom (trailing corner)
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 180,
                height: 140,
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
            // Gold shimmer hairline at bottom
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
            // Content — single row keeps actions aligned with title
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                topInset + AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Title block (leading / right in RTL)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Role label — shown once, small gold text
                        Text(
                          l10n.maintenanceSupervisorRole,
                          style: const TextStyle(
                            color: AppPalette.gold300,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.4,
                          ),
                        ),
                        const SizedBox(height: 4),
                        // Personalised greeting
                        Text(
                          greeting,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        // Subtitle
                        Text(
                          l10n.maintenanceAssignedSubtitle,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.60),
                            fontSize: 13,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  // Actions (trailing / left in RTL) — same row as title
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const NotificationsBell(),
                      const SizedBox(width: AppSpacing.xs),
                      _GlassIconButton(
                        icon: Icons.logout_rounded,
                        onTap: onLogout,
                      ),
                    ],
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

// ── Glass icon button (logout, etc.) ─────────────────────────────────────────

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({required this.icon, required this.onTap});
  final IconData     icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: Icon(icon, color: Colors.white, size: 16),
      ),
    );
  }
}

// ── Summary card ──────────────────────────────────────────────────────────────

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.requests, required this.l10n});
  final List<MaintenanceRequest> requests;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final activeCount = requests
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
        borderRadius: BorderRadius.circular(20),
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
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: AppPalette.gold300.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(9),
                        border: Border.all(
                          color: AppPalette.gold300.withValues(alpha: 0.35),
                        ),
                      ),
                      child: const Icon(Icons.handyman_rounded,
                          color: AppPalette.gold300, size: 17),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      l10n.supervisorSummaryTotalLabel,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.75),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '${requests.length}',
                      style: const TextStyle(
                        color: AppPalette.gold300,
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        height: 1,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Container(height: 0.5, color: Colors.white.withValues(alpha: 0.12)),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    _SummaryCell(
                      label: l10n.supervisorFilterActive,
                      count: activeCount,
                      color: _activeAccent,
                    ),
                    _SummaryDivider(),
                    _SummaryCell(
                      label: l10n.supervisorStatInProgress,
                      count: inProgressCount,
                      color: _inProgressAccent,
                    ),
                    _SummaryDivider(),
                    _SummaryCell(
                      label: l10n.supervisorFilterClosed,
                      count: closedCount,
                      color: _closedAccent,
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
    required this.label,
    required this.count,
    required this.color,
  });
  final String label;
  final int    count;
  final Color  color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '$count',
            style: TextStyle(
              color: color,
              fontSize: 22,
              fontWeight: FontWeight.w900,
              height: 1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.65),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 0.5,
      height: 36,
      color: Colors.white.withValues(alpha: 0.15),
      margin: const EdgeInsets.symmetric(horizontal: 4),
    );
  }
}

// ── Filter row ────────────────────────────────────────────────────────────────

class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.all,
    required this.selected,
    required this.onSelect,
    required this.l10n,
  });
  final List<MaintenanceRequest> all;
  final _FilterKey selected;
  final ValueChanged<_FilterKey> onSelect;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final activeCount = all
        .where((r) =>
            r.status == MaintenanceStatus.open ||
            r.status == MaintenanceStatus.assigned ||
            r.status == MaintenanceStatus.inProgress)
        .length;
    final closedCount = all
        .where((r) =>
            r.status == MaintenanceStatus.resolved ||
            r.status == MaintenanceStatus.closed)
        .length;

    return Container(
      color: context.appColors.canvas,
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 10, 0, 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(right: AppSpacing.lg),
        child: Row(
          children: [
            _FilterChip(
              label: l10n.supervisorFilterAll,
              dot: Colors.white,
              count: all.length,
              selected: selected == _FilterKey.all,
              onTap: () => onSelect(_FilterKey.all),
            ),
            const SizedBox(width: AppSpacing.xs),
            _FilterChip(
              label: l10n.supervisorFilterActive,
              dot: _activeAccent,
              count: activeCount,
              selected: selected == _FilterKey.active,
              onTap: () => onSelect(_FilterKey.active),
            ),
            const SizedBox(width: AppSpacing.xs),
            _FilterChip(
              label: l10n.supervisorFilterClosed,
              dot: _closedAccent,
              count: closedCount,
              selected: selected == _FilterKey.closed,
              onTap: () => onSelect(_FilterKey.closed),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.dot,
    required this.count,
    required this.selected,
    required this.onTap,
  });
  final String       label;
  final Color        dot;
  final int          count;
  final bool         selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? _navyCard : colors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? _navyCard : colors.hairline,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: _navyCard.withValues(alpha: 0.18),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                color: selected ? dot : dot.withValues(alpha: 0.45),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 7),
            Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : colors.inkStrong,
                fontSize: 13,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: selected
                      ? dot.withValues(alpha: 0.22)
                      : colors.hairline.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    color: selected ? dot : colors.inkMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
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
    final isRtl  = Directionality.of(context) == TextDirection.rtl;

    final ct           = _resolveCardTheme(request.status);
    final category     = request.categoryName?.resolve(lang);
    final title        = (category?.isNotEmpty == true) ? category! : l10n.maintenanceFallbackTitle;
    final hasDesc      = request.description.trim().isNotEmpty;

    return GestureDetector(
      onTap: () => context.push('/maintenance/${request.id}', extra: request),
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
                            maintenanceStatusLabel(request.status),
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
                          value: maintenancePriorityLabel(request.priority),
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
                isRtl
                    ? Icons.arrow_back_ios_new_rounded
                    : Icons.arrow_forward_ios_rounded,
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
