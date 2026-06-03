import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../auth/presentation/cubit/staff_auth_cubit.dart';
import '../../domain/entities/maintenance_request.dart';
import '../cubit/maintenance_list_cubit.dart';
import '../maintenance_format.dart';

/// Supervisor home — assigned maintenance requests. The supervisor workspace is
/// scoped to `/maintenance/*` by the router redirect, so this screen carries
/// the notifications + sign-out affordances.
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
    final cubit = context.read<MaintenanceListCubit>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('طلبات الصيانة'),
        actions: [
          IconButton(
            tooltip: 'الإشعارات',
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notifications'),
          ),
          IconButton(
            tooltip: 'تسجيل الخروج',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => context.read<StaffAuthCubit>().logout(),
          ),
        ],
      ),
      body: BlocBuilder<MaintenanceListCubit, MaintenanceListState>(
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const StaffListSkeleton();
            case DataStatus.failure:
              return ErrorState(failure: state.failure, onRetry: cubit.load);
            case DataStatus.empty:
              return const EmptyState(
                icon: Icons.handyman_outlined,
                title: 'لا توجد طلبات مُسندة',
                message: 'ستظهر هنا طلبات الصيانة المُسندة إليك بعد اعتمادها.',
              );
            case DataStatus.success:
              return RefreshIndicator(
                onRefresh: cubit.load,
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: state.requests.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) => _RequestTile(request: state.requests[i]),
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
    final theme = Theme.of(context);
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final category = request.categoryName?.resolve(lang);
    final title = (category?.isNotEmpty == true)
        ? category!
        : (request.customerName ?? 'طلب صيانة');
    final subtitle = [
      if (request.customerName != null && category?.isNotEmpty == true) request.customerName!,
      if (request.unitCode != null) request.unitCode!,
      if (request.dueAt != null) DateFormatter.shortDate(request.dueAt!, languageCode: lang),
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
                      Text(subtitle,
                          style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
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
          if (request.isOverdue || request.complaintAt != null || request.unresolvedAt != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                if (request.isOverdue)
                  const StatusBadge(label: 'متأخر', tone: BadgeTone.error),
                if (request.complaintAt != null)
                  const StatusBadge(label: 'شكوى', tone: BadgeTone.warning),
                if (request.unresolvedAt != null)
                  const StatusBadge(label: 'لم تُحل', tone: BadgeTone.error),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
