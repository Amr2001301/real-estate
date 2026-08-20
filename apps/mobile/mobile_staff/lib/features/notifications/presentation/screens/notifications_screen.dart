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
      body: Column(
        children: [
          // Premium navy header matching the Customer app's notifications screen
          AppNavHeader(
            title: l10n.accountNotifications,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_rounded,
              tooltip: l10n.actionCancel,
              onTap: () => context.pop(),
            ),
            actions: [
              BlocBuilder<NotificationsCubit, NotificationsState>(
                builder: (context, state) => state.status == DataStatus.success
                    ? NavHeaderAction(
                        icon: Icons.done_all_rounded,
                        tooltip: l10n.markAllRead,
                        onTap: () =>
                            context.read<NotificationsCubit>().markAllRead(),
                      )
                    : const SizedBox.shrink(),
              ),
            ],
          ),
          // Body
          Expanded(
            child: BlocConsumer<NotificationsCubit, NotificationsState>(
              listenWhen: (a, b) =>
                  b.status == DataStatus.success ||
                  b.status == DataStatus.empty,
              listener: (context, _) =>
                  context.read<UnreadCountCubit>().load(),
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const _NotificationsSkeleton();
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () =>
                          context.read<NotificationsCubit>().load(),
                    );
                  case DataStatus.empty:
                    return RefreshIndicator(
                      onRefresh: () =>
                          context.read<NotificationsCubit>().load(),
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          SizedBox(
                              height:
                                  MediaQuery.of(context).size.height * 0.15),
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
                      onRefresh: () =>
                          context.read<NotificationsCubit>().load(),
                      child: ListView.separated(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        itemCount: items.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) =>
                            _NotificationTile(items[i]),
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

/// Resolves the in-app navigation route for a staff notification.
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
  if (code.startsWith('broker_lead_') ||
      code.startsWith('broker_commission_') ||
      code.startsWith('broker_payout_')) {
    return '/broker/commissions';
  }
  if (code.startsWith('payment_proof_') ||
      code.startsWith('booking_payment_proof_')) {
    return '/payments-review';
  }
  return null;
}

/// Maps a notification template code to a category icon and color.
({IconData icon, Color color}) _categoryStyle(String code) {
  if (code.startsWith('visit_')) {
    return (icon: Icons.event_rounded, color: const Color(0xFF60A5FA));
  }
  if (code.startsWith('reservation_')) {
    return (icon: Icons.bookmark_rounded, color: const Color(0xFF34C77B));
  }
  if (code.startsWith('maintenance_')) {
    return (icon: Icons.build_rounded, color: const Color(0xFFFBBF24));
  }
  if (code.startsWith('payment_') || code.startsWith('booking_payment_')) {
    return (icon: Icons.payment_rounded, color: AppPalette.gold400);
  }
  if (code.startsWith('broker_commission_') ||
      code.startsWith('broker_payout_')) {
    return (
      icon: Icons.account_balance_wallet_rounded,
      color: const Color(0xFFA78BFA)
    );
  }
  if (code.startsWith('lead_')) {
    return (icon: Icons.person_rounded, color: const Color(0xFF60A5FA));
  }
  return (icon: Icons.notifications_rounded, color: AppPalette.gold400);
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile(this.notification);
  final AppNotification notification;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final title = notification.title.isNotEmpty
        ? notification.title
        : l10n.notificationDefaultTitle;
    final message = notification.payload['message'];
    final subtitle = notification.body.isNotEmpty
        ? notification.body
        : (message is String ? message : null);

    final style = _categoryStyle(notification.templateCode);
    final isUnread = !notification.read;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: isUnread
            ? colors.brandGold.withValues(alpha: 0.06)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
          color: isUnread
              ? colors.brandGold.withValues(alpha: 0.22)
              : colors.hairline,
          width: isUnread ? 1 : 0.5,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () {
            if (isUnread) {
              context.read<NotificationsCubit>().markRead(notification.id);
            }
            final route = _resolveStaffRoute(notification);
            if (route != null) context.push(route);
          },
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Category icon tile
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: style.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(style.icon, size: 18, color: style.color),
                ),
                const SizedBox(width: AppSpacing.md),
                // Text content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: isUnread
                                  ? FontWeight.w800
                                  : FontWeight.w600,
                            ),
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          style: Theme.of(context).textTheme.bodyMedium,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      if (notification.createdAt != null) ...[
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          DateFormatter.shortDate(notification.createdAt!,
                              languageCode: lang),
                          style: Theme.of(context)
                              .textTheme
                              .labelSmall
                              ?.copyWith(color: colors.inkMuted),
                        ),
                      ],
                    ],
                  ),
                ),
                // Unread dot
                if (isUnread)
                  Container(
                    width: 8,
                    height: 8,
                    margin: const EdgeInsetsDirectional.only(
                        top: 4, start: AppSpacing.xs),
                    decoration: BoxDecoration(
                      color: colors.brandGold,
                      shape: BoxShape.circle,
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

class _NotificationsSkeleton extends StatelessWidget {
  const _NotificationsSkeleton();

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.lg),
        itemCount: 6,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, _) => AppCard(
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: context.appColors.surfaceSoft,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Notification title',
                        style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 4),
                    Text('Notification body text',
                        style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
