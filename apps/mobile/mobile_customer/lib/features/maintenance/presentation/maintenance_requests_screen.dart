import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/entities/maintenance_request.dart';
import 'maintenance_format.dart';
import 'maintenance_requests_cubit.dart';

/// Lists the customer's maintenance requests with status chips, and a button
/// to file a new one. Tapping a request opens its detail (with photos/docs).
class MaintenanceRequestsScreen extends StatefulWidget {
  const MaintenanceRequestsScreen({super.key});

  @override
  State<MaintenanceRequestsScreen> createState() =>
      _MaintenanceRequestsScreenState();
}

class _MaintenanceRequestsScreenState extends State<MaintenanceRequestsScreen> {
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
    // Body-only: the CustomerShellScaffold supplies the app bar + bottom nav.
    // "New request" is a top action (not a FAB), so it can never hide behind
    // the floating bottom nav.
    return BlocBuilder<MaintenanceRequestsCubit, MaintenanceRequestsState>(
      builder: (context, state) {
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
            // The body's bottom inset already accounts for the shell's bottom
            // nav, so the floating button sits just a small gap above it. The
            // list reserves enough bottom space that the last card never hides
            // behind the button.
            final bottomInset = MediaQuery.of(context).padding.bottom;
            return Stack(
              children: [
                RefreshIndicator(
                  onRefresh: () =>
                      context.read<MaintenanceRequestsCubit>().load(),
                  child: ListView.separated(
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.lg,
                      AppSpacing.lg,
                      AppSpacing.lg,
                      bottomInset + 92,
                    ),
                    itemCount: requests.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: AppSpacing.md),
                    itemBuilder: (context, i) =>
                        _RequestTile(request: requests[i]),
                  ),
                ),
                PositionedDirectional(
                  end: AppSpacing.lg,
                  bottom: bottomInset + AppSpacing.md,
                  child: _NewRequestFab(onTap: _openCreate),
                ),
              ],
            );
        }
      },
    );
  }
}

class _RequestTile extends StatelessWidget {
  const _RequestTile({required this.request});

  final MaintenanceRequest request;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final category = request.categoryName?.resolve(lang);

    final title = category?.isNotEmpty == true
        ? category!
        : l10n.accountMaintenance;

    final unitCode = request.unitCode;

    return PremiumCard(
      glow: true,
      accentRail: AppTone.gold,
      elevation: AppCardElevation.soft,
      padding: const EdgeInsets.all(AppSpacing.lg),
      onTap: () =>
          context.push('/account/maintenance/${request.id}', extra: request),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header: icon + category/unit + status ──────────────────────
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(
                icon: AppIcons.maintenance,
                tone: AppTone.navy,
                size: IconChipSize.md,
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
                    if (unitCode != null && unitCode.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(
                            AppIcons.property,
                            size: 15,
                            color: colors.inkMuted,
                          ),
                          const SizedBox(width: AppSpacing.xxs),
                          Flexible(
                            child: Text(
                              unitCode,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodyMedium?.copyWith(
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
              const SizedBox(width: AppSpacing.sm),
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

          // ── Description (full width) ────────────────────────────────────
          Text(
            request.description,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colors.ink,
              height: 1.45,
            ),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),

          const SizedBox(height: AppSpacing.md),

          // ── Footer: date + priority ─────────────────────────────────────
          Row(
            children: [
              if (request.createdAt != null) ...[
                Icon(AppIcons.calendar, size: 15, color: colors.inkMuted),
                const SizedBox(width: AppSpacing.xxs),
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
    );
  }
}

/// Floating "new request" pill — a navy action that sits above the bottom nav
/// (positioned by the screen), so it's always reachable and never overlaps
/// content or the navbar.
class _NewRequestFab extends StatelessWidget {
  const _NewRequestFab({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;
    return Container(
      decoration: BoxDecoration(
        color: colors.brandNavy,
        borderRadius: AppRadii.pillAll,
        boxShadow: colors.shadowLift,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: AppRadii.pillAll,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.md,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.add_rounded, color: Colors.white, size: 20),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  l10n.maintenanceNewRequest,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
