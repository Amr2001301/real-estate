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
    // App bar comes from the CustomerShellScaffold; we keep an app-bar-less
    // Scaffold here so the "new request" FAB still has a host.
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreate,
        icon: const Icon(Icons.add_rounded),
        label: Text(l10n.maintenanceNewRequest),
      ),
      body: BlocBuilder<MaintenanceRequestsCubit, MaintenanceRequestsState>(
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
              return RefreshIndicator(
                onRefresh: () =>
                    context.read<MaintenanceRequestsCubit>().load(),
                child: ListView.separated(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.lg + MediaQuery.of(context).padding.bottom,
                  ),
                  itemCount: requests.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) =>
                      _RequestTile(request: requests[i]),
                ),
              );
          }
        },
      ),
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

    return PremiumCard(
      elevation: AppCardElevation.soft,
      onTap: () =>
          context.push('/account/maintenance/${request.id}', extra: request),
      child: Row(
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
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: colors.inkStrong,
                          fontWeight: FontWeight.w700,
                        ),
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
                const SizedBox(height: AppSpacing.xs),
                Text(
                  request.description,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colors.inkMuted,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (request.createdAt != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Icon(AppIcons.calendar, size: 13, color: colors.inkMuted),
                      const SizedBox(width: AppSpacing.xxs),
                      Text(
                        DateFormatter.shortDate(
                          request.createdAt!,
                          languageCode: lang,
                        ),
                        style: theme.textTheme.labelSmall?.copyWith(
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
    );
  }
}
