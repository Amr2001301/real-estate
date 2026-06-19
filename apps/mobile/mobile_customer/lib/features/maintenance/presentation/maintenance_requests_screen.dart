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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state;
    final displayName =
        session.sessionOrNull?.displayName ?? session.sessionOrNull?.email;

    return BlocBuilder<MaintenanceRequestsCubit, MaintenanceRequestsState>(
      builder: (context, state) {
        final requestCount =
            state.status == DataStatus.success ? state.data!.length : null;

        return Column(
          children: [
            _MaintenanceHeader(
              displayName: displayName,
              requestCount: requestCount,
              onNewRequest: _openCreate,
              l10n: l10n,
            ),
            Expanded(child: _buildBody(context, state, l10n)),
          ],
        );
      },
    );
  }

  Widget _buildBody(
    BuildContext context,
    MaintenanceRequestsState state,
    AppLocalizations l10n,
  ) {
    switch (state.status) {
      case DataStatus.initial:
      case DataStatus.loading:
        return const Center(child: CircularProgressIndicator());
      case DataStatus.failure:
        return ErrorState(
          failure: state.failure,
          onRetry: () => context.read<MaintenanceRequestsCubit>().load(),
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
        final requests = state.data!;
        return RefreshIndicator(
          onRefresh: () => context.read<MaintenanceRequestsCubit>().load(),
          child: ListView.separated(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.lg + MediaQuery.of(context).padding.bottom,
            ),
            itemCount: requests.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
            itemBuilder: (context, i) => _RequestCard(request: requests[i])
                .animate(delay: Duration(milliseconds: 60 * i))
                .fadeIn(duration: 340.ms)
                .slideY(
                  begin: 0.05,
                  end: 0,
                  duration: 340.ms,
                  curve: Curves.easeOut,
                ),
          ),
        );
    }
  }
}

// ── Screen header ─────────────────────────────────────────────────────────────

class _MaintenanceHeader extends StatelessWidget {
  const _MaintenanceHeader({
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
            const Positioned.fill(child: IgnorePointer(child: _HeaderDots())),
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
                      AppPalette.gold400.withValues(alpha: 0.55),
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
                  // START (right in RTL): avatar → profile
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
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.2),
                                  ),
                                ),
                                child: Text(
                                  '$requestCount',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
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
                  // New request button (compact pill)
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
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.add_rounded,
                            color: _navyDeep,
                            size: 16,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'جديد',
                            style: const TextStyle(
                              color: _navyDeep,
                              fontSize: 12,
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

// ── Request card ──────────────────────────────────────────────────────────────

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request});
  final MaintenanceRequest request;

  Color _railColor(MaintenanceStatus s) {
    return switch (s) {
      MaintenanceStatus.open => const Color(0xFFD4A017),
      MaintenanceStatus.assigned => const Color(0xFF3B82F6),
      MaintenanceStatus.inProgress => const Color(0xFF3B82F6),
      MaintenanceStatus.resolved => const Color(0xFF22C55E),
      MaintenanceStatus.closed => const Color(0xFF22C55E),
      MaintenanceStatus.unknown => const Color(0xFF94A3B8),
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    final category = request.categoryName?.resolve(lang);
    final title = (category?.isNotEmpty == true)
        ? category!
        : l10n.accountMaintenance;
    final railColor = _railColor(request.status);

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
              blurRadius: 18,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Status color rail at START edge
              Container(
                width: 4,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [railColor, railColor.withValues(alpha: 0.35)],
                  ),
                ),
              ),
              // Card content
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header: icon + title/unit + status badge
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [_navyLight, _navyDeep],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.build_rounded,
                              color: AppPalette.gold400,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    color: colors.inkStrong,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                if (request.unitCode?.isNotEmpty == true) ...[
                                  const SizedBox(height: 3),
                                  Row(
                                    children: [
                                      Icon(
                                        AppIcons.property,
                                        size: 13,
                                        color: AppPalette.gold500,
                                      ),
                                      const SizedBox(width: 4),
                                      Flexible(
                                        child: Text(
                                          request.unitCode!,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: theme.textTheme.bodySmall
                                              ?.copyWith(
                                            color: colors.inkMuted,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          StatusBadge(
                            label: maintenanceStatusLabel(l10n, request.status),
                            tone: maintenanceStatusTone(request.status),
                            dot: true,
                          ),
                        ],
                      ),

                      const SizedBox(height: AppSpacing.md),
                      Divider(height: 1, color: colors.hairline),
                      const SizedBox(height: AppSpacing.md),

                      // Description
                      Text(
                        request.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: colors.ink,
                          height: 1.5,
                        ),
                      ),

                      const SizedBox(height: AppSpacing.md),

                      // Footer: date + priority
                      Row(
                        children: [
                          if (request.createdAt != null) ...[
                            Icon(
                              AppIcons.calendar,
                              size: 14,
                              color: colors.inkMuted,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              DateFormatter.shortDate(
                                request.createdAt!,
                                languageCode: lang,
                              ),
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colors.inkMuted,
                              ),
                            ),
                          ],
                          const Spacer(),
                          StatusBadge(
                            label: l10n.maintenancePriorityValue(
                              maintenancePriorityLabel(l10n, request.priority),
                            ),
                            tone: maintenancePriorityTone(request.priority),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
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

// ── Dot texture ───────────────────────────────────────────────────────────────

class _HeaderDots extends StatelessWidget {
  const _HeaderDots();
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
