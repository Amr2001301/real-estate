import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/entities/app_notification.dart';
import 'notification_route.dart';
import 'notifications_cubit.dart';
import 'unread_count_cubit.dart';


// ─────────────────────────────────────────────────────────────────────────────
// Notifications Screen
// ─────────────────────────────────────────────────────────────────────────────

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
      backgroundColor: context.appColors.canvas,
      body: Column(
        children: [
          BlocBuilder<NotificationsCubit, NotificationsState>(
            builder: (context, state) {
              final unread =
                  state.data?.where((n) => !n.read).length ?? 0;
              return _Header(
                l10n: l10n,
                unreadCount: unread,
                canMarkAll:
                    state.status == DataStatus.success && unread > 0,
                onMarkAll: () =>
                    context.read<NotificationsCubit>().markAllRead(),
              );
            },
          ),
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
                    return const Center(child: CircularProgressIndicator());
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () =>
                          context.read<NotificationsCubit>().load(),
                    );
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.notifications_none_rounded,
                      title: l10n.notificationsEmptyTitle,
                      message: l10n.notificationsEmptyMessage,
                    );
                  case DataStatus.success:
                    final items = state.data!;
                    final hasMore = context.read<NotificationsCubit>().hasMore;
                    return RefreshIndicator(
                      onRefresh: () =>
                          context.read<NotificationsCubit>().load(),
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.md,
                          AppSpacing.lg,
                          AppSpacing.xl +
                              MediaQuery.of(context).padding.bottom,
                        ),
                        itemCount: items.length + (hasMore ? 1 : 0),
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (_, i) => i == items.length
                            ? const _ShowMore()
                            : _NotificationTile(
                          notification: items[i],
                          onTap: () {
                            final n = items[i];
                            if (!n.read) {
                              context
                                  .read<NotificationsCubit>()
                                  .markRead(n.id);
                            }
                            final route = _resolveRoute(n);
                            if (route != null) context.push(route);
                          },
                        ),
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

/// "Show more" at the end of the list while older notifications remain.
class _ShowMore extends StatelessWidget {
  const _ShowMore();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: TextButton(
        onPressed: () => context.read<NotificationsCubit>().loadMore(),
        child: Text(context.l10n.showMore),
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  const _Header({
    required this.l10n,
    required this.unreadCount,
    required this.canMarkAll,
    required this.onMarkAll,
  });

  final AppLocalizations l10n;
  final int unreadCount;
  final bool canMarkAll;
  final VoidCallback onMarkAll;

  @override
  Widget build(BuildContext context) {
    return AppNavHeader(
      title: l10n.accountNotifications,
      subtitle: unreadCount > 0 ? '$unreadCount ${unreadCount == 1 ? 'إشعار جديد' : 'إشعارات جديدة'}' : null,
      compact: true,
      leadingAction: const NavHeaderBack(),
      actions: [
        if (canMarkAll) NavHeaderAction(icon: Icons.done_all_rounded, tooltip: l10n.markAllRead, onTap: onMarkAll),
        NavHeaderAction(
          icon: Icons.tune_rounded,
          tooltip: l10n.notificationPrefsTitle,
          onTap: () => context.push('/account/notifications/preferences'),
        ),
      ],
    );
  }
}

// ── Notification tile ─────────────────────────────────────────────────────────

bool _matches(AppNotification n, List<String> keys) {
  final s =
      '${n.title} ${n.body} ${n.payload.values.whereType<String>().join(' ')}'
          .toLowerCase();
  return keys.any(s.contains);
}

/// Resolves the in-app navigation route for a notification (shared with push
/// taps — see [customerNotificationRoute]). Returns null when no screen applies.
String? _resolveRoute(AppNotification n) =>
    customerNotificationRoute(n.templateCode, n.payload);

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  IconData get _icon {
    final n = notification;
    if (_matches(n, ['visit', 'زيارة', 'appointment', 'موعد', 'جدول'])) {
      return Icons.event_rounded;
    }
    if (_matches(n, ['contract', 'عقد', 'sign', 'وقّع', 'وقع'])) {
      return Icons.description_rounded;
    }
    if (_matches(n, ['payment', 'دفع', 'installment', 'قسط', 'deposit', 'إيداع'])) {
      return Icons.payments_rounded;
    }
    if (_matches(n, ['maintenance', 'صيانة', 'repair', 'إصلاح'])) {
      return Icons.build_rounded;
    }
    if (_matches(n, ['rate', 'تقيّم', 'review', 'تقييم'])) {
      return Icons.star_rounded;
    }
    return Icons.notifications_rounded;
  }

  (Color, Color) get _iconStyle {
    final n = notification;
    if (_matches(n, ['visit', 'زيارة', 'appointment', 'موعد'])) {
      return (const Color(0xFF1E3A6E), const Color(0xFF93C5FD));
    }
    if (_matches(n, ['contract', 'عقد', 'sign'])) {
      return (const Color(0xFF1B5E3F), const Color(0xFF4ADE80));
    }
    if (_matches(n, ['payment', 'دفع', 'installment', 'قسط'])) {
      return (const Color(0xFF3B2400), AppPalette.gold300);
    }
    if (_matches(n, ['maintenance', 'صيانة'])) {
      return (const Color(0xFF7C3208), const Color(0xFFFBBF24));
    }
    if (_matches(n, ['rate', 'تقيّم', 'review', 'تقييم'])) {
      return (const Color(0xFF3B1E5E), const Color(0xFFB98CF3));
    }
    return (const Color(0xFF243F62), AppPalette.gold300);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final l10n = context.l10n;
    final unread = !notification.read;

    final title = notification.title.isNotEmpty
        ? notification.title
        : l10n.notificationDefaultTitle;
    final rawMsg = notification.payload['message'];
    final subtitle = notification.body.isNotEmpty
        ? notification.body
        : (rawMsg is String ? rawMsg : null);

    final icon = _icon;
    final (_, baseFg) = _iconStyle;
    final dark = theme.brightness == Brightness.dark;
    final iconFg =
        dark ? baseFg : Color.lerp(baseFg, Colors.black, 0.4) ?? baseFg;
    final iconBg = iconFg.withValues(alpha: 0.14);

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: unread
              ? AppPalette.gold300.withValues(alpha: 0.04)
              : colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: unread
                ? AppPalette.gold300.withValues(alpha: 0.30)
                : colors.hairline.withValues(alpha: 0.45),
            width: unread ? 1.5 : 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: unread ? 0.08 : 0.04),
              blurRadius: unread ? 16 : 10,
              offset: const Offset(0, 3),
            ),
            if (unread)
              BoxShadow(
                color: AppPalette.gold300.withValues(alpha: 0.06),
                blurRadius: 20,
                spreadRadius: 1,
              ),
          ],
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Start-side accent rail (right in RTL)
              Container(
                width: 4,
                color: unread ? AppPalette.gold300 : colors.hairline,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Icon tile
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: iconBg,
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: Icon(icon, color: iconFg, size: 20),
                      ),
                      const SizedBox(width: AppSpacing.md),
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
                                    style: theme.textTheme.bodyMedium
                                        ?.copyWith(
                                      color: colors.inkStrong,
                                      fontWeight: unread
                                          ? FontWeight.w800
                                          : FontWeight.w600,
                                      height: 1.3,
                                    ),
                                  ),
                                ),
                                if (unread) ...[
                                  const SizedBox(width: 8),
                                  Container(
                                    width: 8,
                                    height: 8,
                                    margin: const EdgeInsets.only(top: 4),
                                    decoration: const BoxDecoration(
                                      color: AppPalette.gold300,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            if (subtitle != null &&
                                subtitle.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                subtitle,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: colors.inkMuted,
                                  height: 1.5,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                            if (notification.createdAt != null) ...[
                              const SizedBox(height: 6),
                              Text(
                                DateFormatter.shortDate(
                                  notification.createdAt!,
                                  languageCode: lang,
                                ),
                                style: TextStyle(
                                  color: colors.inkMuted
                                      .withValues(alpha: 0.65),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ],
                        ),
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

// ── Shared widgets ────────────────────────────────────────────────────────────

