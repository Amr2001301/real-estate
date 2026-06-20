import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/app_notification.dart';
import '../cubit/notifications_cubit.dart';
import '../cubit/unread_count_cubit.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<NotificationsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.accountNotifications),
        actions: [
          BlocBuilder<NotificationsCubit, NotificationsState>(
            builder: (context, state) => state.status == DataStatus.success
                ? TextButton(
                    onPressed: () => context.read<NotificationsCubit>().markAllRead(),
                    child: Text(l10n.markAllRead),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
      body: BlocConsumer<NotificationsCubit, NotificationsState>(
        // Keep the app-wide unread badge in sync after reads/loads.
        listenWhen: (a, b) => b.status == DataStatus.success || b.status == DataStatus.empty,
        listener: (context, _) => context.read<UnreadCountCubit>().load(),
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<NotificationsCubit>().load(),
              );
            case DataStatus.empty:
              return RefreshIndicator(
                onRefresh: () => context.read<NotificationsCubit>().load(),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    SizedBox(height: MediaQuery.of(context).size.height * 0.15),
                    EmptyState(
                      icon: Icons.notifications_none_rounded,
                      title: l10n.notificationsEmptyTitle,
                      message: l10n.notificationsEmptyMessage,
                    ),
                  ],
                ),
              );
            case DataStatus.success:
              final items = state.data!;
              return RefreshIndicator(
                onRefresh: () => context.read<NotificationsCubit>().load(),
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) => _NotificationTile(items[i]),
                ),
              );
          }
        },
      ),
    );
  }
}

/// Resolves the in-app navigation route for a staff notification.
/// Returns null when no specific deep-link target applies.
String? _resolveStaffRoute(AppNotification n) {
  final code = n.templateCode;
  final entityId = n.payload['entityId'] as String?;

  if (code.startsWith('maintenance_')) {
    final id = entityId ?? n.payload['requestId'] as String?;
    if (id != null && id.isNotEmpty) return '/maintenance/$id';
    return '/maintenance';
  }
  if (code.startsWith('visit_')) {
    final id = entityId ?? n.payload['visitId'] as String?;
    if (id != null && id.isNotEmpty) return '/visits/$id';
    return '/visits';
  }
  if (code.startsWith('reservation_')) {
    final id = entityId ?? n.payload['reservationId'] as String?;
    if (id != null && id.isNotEmpty) return '/reservations/$id';
    return '/reservations';
  }
  if (code.startsWith('lead_')) {
    final id = entityId ?? n.payload['leadId'] as String?;
    if (id != null && id.isNotEmpty) return '/leads/$id';
  }
  if (code.startsWith('broker_lead_') || code.startsWith('broker_commission_') || code.startsWith('broker_payout_')) {
    return '/broker/commissions';
  }
  if (code.startsWith('payment_proof_') || code.startsWith('booking_payment_proof_')) {
    return '/payments-review';
  }
  return null;
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile(this.notification);
  final AppNotification notification;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    // Prefer the backend-resolved title/body; fall back to payload/default.
    final title = notification.title.isNotEmpty
        ? notification.title
        : l10n.notificationDefaultTitle;
    final message = notification.payload['message'];
    final subtitle = notification.body.isNotEmpty
        ? notification.body
        : (message is String ? message : null);

    return AppCard(
      onTap: () {
        if (!notification.read) {
          context.read<NotificationsCubit>().markRead(notification.id);
        }
        final route = _resolveStaffRoute(notification);
        if (route != null) context.push(route);
      },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 10,
            height: 10,
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              color: notification.read ? colors.hairline : colors.brandGold,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
                ],
                if (notification.createdAt != null) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    DateFormatter.shortDate(notification.createdAt!, languageCode: lang),
                    style: Theme.of(context)
                        .textTheme
                        .labelSmall
                        ?.copyWith(color: colors.inkMuted),
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
