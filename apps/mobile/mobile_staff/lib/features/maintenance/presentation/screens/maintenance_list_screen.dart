import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../auth/presentation/cubit/staff_auth_cubit.dart';
import '../../../notifications/presentation/widgets/notifications_bell.dart';
import '../../domain/entities/maintenance_request.dart';
import '../cubit/maintenance_list_cubit.dart';
import '../maintenance_format.dart';

/// Supervisor home — assigned maintenance requests. The supervisor workspace is
/// scoped to `/maintenance/*` by the router redirect, so this screen carries
/// the notifications + sign-out affordances in the [AppNavHeader].
class MaintenanceListScreen extends StatefulWidget {
  const MaintenanceListScreen({super.key});

  @override
  State<MaintenanceListScreen> createState() => _MaintenanceListScreenState();
}

class _MaintenanceListScreenState extends State<MaintenanceListScreen> {
  @override
  void initState() {
    super.initState();
    context.read<MaintenanceListCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<MaintenanceListCubit>();
    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.supervisorMaintenanceTitle,
            actions: [
              const NotificationsBell(),
              const SizedBox(width: AppSpacing.xs),
              NavHeaderAction(
                icon: Icons.logout_rounded,
                tooltip: l10n.actionLogout,
                onTap: () async {
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
            ],
          ),
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
                      icon: Icons.handyman_outlined,
                      title: l10n.supervisorNoAssignedTitle,
                      message: l10n.supervisorNoAssignedMessage,
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        itemCount: state.requests.length,
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) =>
                            _RequestTile(request: state.requests[i]),
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

class _RequestTile extends StatelessWidget {
  const _RequestTile({required this.request});
  final MaintenanceRequest request;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.appColors;
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final category = request.categoryName?.resolve(lang);
    final title = (category?.isNotEmpty == true)
        ? category!
        : (request.customerName ?? l10n.maintenanceFallbackTitle);
    final subtitle = [
      if (request.customerName != null && category?.isNotEmpty == true)
        request.customerName!,
      if (request.unitCode != null) request.unitCode!,
      if (request.dueAt != null)
        DateFormatter.shortDate(request.dueAt!, languageCode: lang),
    ].join(' · ');

    return AppCard(
      onTap: () => context.push('/maintenance/${request.id}', extra: request),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: theme.textTheme.titleSmall),
                    if (subtitle.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: colors.inkMuted),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              StatusBadge(
                label: maintenanceStatusLabel(request.status),
                tone: maintenanceStatusTone(request.status),
              ),
            ],
          ),
          if (request.isOverdue ||
              request.complaintAt != null ||
              request.unresolvedAt != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                if (request.isOverdue)
                  StatusBadge(
                    label: l10n.maintenanceOverdue,
                    tone: BadgeTone.error,
                  ),
                if (request.complaintAt != null)
                  StatusBadge(
                    label: l10n.maintenanceComplaint,
                    tone: BadgeTone.warning,
                  ),
                if (request.unresolvedAt != null)
                  StatusBadge(
                    label: l10n.maintenanceUnresolved,
                    tone: BadgeTone.error,
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
