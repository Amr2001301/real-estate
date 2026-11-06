import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/entities/app_notification.dart';
import 'notification_route.dart';
import 'notifications_cubit.dart';
import 'unread_count_cubit.dart';

enum _Filter { all, unread, finance, maintenance }

/// The notification's family: what the filters tell apart.
_Filter _familyOf(String code) {
  const finance = ['deposit_', 'installment_', 'cheque_', 'payment_', 'booking_payment_'];
  if (finance.any(code.startsWith)) return _Filter.finance;
  if (code.startsWith('maintenance_')) return _Filter.maintenance;
  return _Filter.all;
}

/// The icon and tint of a notification, as in the staff app.
({IconData icon, Color color}) _style(String code) {
  if (code.startsWith('visit_') || code.startsWith('info_request_')) return (icon: Icons.event_rounded, color: const Color(0xFF26405F));
  if (code.startsWith('reservation_')) return (icon: Icons.bookmark_rounded, color: const Color(0xFF2F6B4A));
  if (code.startsWith('maintenance_')) return (icon: Icons.build_rounded, color: const Color(0xFF8A5A12));
  if (code.startsWith('payment_') || code.startsWith('booking_payment_') || code.startsWith('deposit_')) {
    return (icon: Icons.payments_rounded, color: AppPalette.gold600);
  }
  if (code.startsWith('cheque_')) return (icon: Icons.receipt_long_rounded, color: const Color(0xFFB3261E));
  if (code.startsWith('installment_')) return (icon: Icons.calendar_month_rounded, color: const Color(0xFF8A5A12));
  if (code.startsWith('contract_') || code == 'unit_handed_over' || code == 'delivery_delayed_customer') {
    return (icon: Icons.description_rounded, color: AppPalette.gold600);
  }
  return (icon: Icons.campaign_rounded, color: AppPalette.gold600);
}

/// Resolves the in-app navigation route for a notification (shared with push
/// taps — see [customerNotificationRoute]). Returns null when no screen applies.
String? _resolveRoute(AppNotification n) => customerNotificationRoute(n.templateCode, n.payload);

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  _Filter _filter = _Filter.all;

  @override
  void initState() {
    super.initState();
    context.read<NotificationsCubit>().load();
  }

  bool _matches(AppNotification n) => switch (_filter) {
        _Filter.all => true,
        _Filter.unread => !n.read,
        _ => _familyOf(n.templateCode) == _filter,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<NotificationsCubit>();
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocConsumer<NotificationsCubit, NotificationsState>(
          listenWhen: (a, b) => b.status == DataStatus.success || b.status == DataStatus.empty,
          listener: (context, _) => context.read<UnreadCountCubit>().load(),
          builder: (context, state) {
            final all = state.data ?? const <AppNotification>[];
            final ready = state.status == DataStatus.success || state.status == DataStatus.empty;
            final unread = all.where((n) => !n.read).length;
            final shown = all.where(_matches).toList();
            int count(_Filter f) => all.where((n) => f == _Filter.unread ? !n.read : _familyOf(n.templateCode) == f).length;
            void pick(_Filter f) => setState(() => _filter = _filter == f ? _Filter.all : f);
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.accountNotifications,
                      subtitle: ready ? (unread == 0 ? l10n.ntAllRead : l10n.ntUnreadN(unread)) : null,
                      back: true,
                      actions: [
                        HomeHeroButton(
                          key: const Key('notifications-prefs'),
                          icon: Icons.tune_rounded,
                          tooltip: l10n.ntPrefs,
                          onTap: () => context.push('/account/notifications/preferences'),
                        ),
                        if (unread > 0)
                          HomeHeroButton(key: const Key('notifications-read-all'), icon: Icons.done_all_rounded, tooltip: l10n.markAllRead, onTap: cubit.markAllRead),
                      ],
                    ),
                  ),
                  if (ready && all.isNotEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 14),
                        child: HomePills(pills: [
                          HomePill(id: 'all', label: l10n.ntAll, count: all.length, selected: _filter == _Filter.all, onTap: () => setState(() => _filter = _Filter.all)),
                          HomePill(id: 'unread', label: l10n.ntUnread, count: unread, dot: AppPalette.gold500, selected: _filter == _Filter.unread, onTap: () => pick(_Filter.unread)),
                          HomePill(id: 'finance', label: l10n.ntFinance, count: count(_Filter.finance), dot: const Color(0xFF3E7C5A), selected: _filter == _Filter.finance, onTap: () => pick(_Filter.finance)),
                          HomePill(id: 'maintenance', label: l10n.accountMaintenance, count: count(_Filter.maintenance), dot: const Color(0xFF8A5A12), selected: _filter == _Filter.maintenance, onTap: () => pick(_Filter.maintenance)),
                        ]),
                      ),
                    ),
                  ...switch (state.status) {
                    DataStatus.initial || DataStatus.loading when all.isEmpty => [const SliverToBoxAdapter(child: _Skeleton())],
                    DataStatus.failure when all.isEmpty => [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: cubit.load))],
                    DataStatus.empty => [
                        SliverToBoxAdapter(child: EmptyState(icon: Icons.notifications_none_rounded, title: l10n.notificationsEmptyTitle, message: l10n.notificationsEmptyMessage)),
                      ],
                    _ when shown.isEmpty => [SliverToBoxAdapter(child: EmptyState(icon: Icons.filter_list_off_rounded, title: l10n.ntNoMatch))],
                    _ => [
                        ..._days(context, shown),
                        if (cubit.hasMore) SliverToBoxAdapter(child: Center(child: TextButton(onPressed: cubit.loadMore, child: Text(l10n.showMore)))),
                      ],
                  },
                  SliverPadding(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 110)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  /// The list under «اليوم» / «أمس» / the date.
  List<Widget> _days(BuildContext context, List<AppNotification> items) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final today = homeDay(DateTime.now());
    String label(DateTime d) {
      final diff = today.difference(homeDay(d)).inDays;
      if (diff == 0) return l10n.ntToday;
      if (diff == 1) return l10n.ntYesterday;
      return DateFormatter.mediumDate(d, languageCode: lang);
    }

    final out = <Widget>[];
    String? current;
    for (final n in items) {
      final at = n.createdAt?.toLocal();
      final day = at == null ? '' : label(at);
      if (day != current) {
        current = day;
        out.add(SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 14, AppSpacing.lg, 6),
            child: Text(day, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: colors.inkMuted)),
          ),
        ));
      }
      out.add(SliverPadding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 0, AppSpacing.md, 9),
        sliver: SliverToBoxAdapter(child: _Tile(n)),
      ));
    }
    return out;
  }
}

class _Tile extends StatelessWidget {
  const _Tile(this.n);
  final AppNotification n;

  String _ago(BuildContext context, DateTime at) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final d = DateTime.now().difference(at);
    if (d.inMinutes < 1) return l10n.bcNow;
    if (d.inHours < 24) return DateFormatter.time(at.toLocal(), languageCode: lang);
    return DateFormatter.dayMonth(at.toLocal(), languageCode: lang);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final title = n.title.isNotEmpty ? n.title : l10n.notificationDefaultTitle;
    final message = n.payload['message'];
    final body = n.body.isNotEmpty ? n.body : (message is String ? message : null);
    final s = _style(n.templateCode);
    final unread = !n.read;
    return Material(
      color: unread ? homeTint(context) : colors.surface,
      borderRadius: BorderRadius.circular(20),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: Key('notification-${n.id}'),
        onTap: () {
          if (unread) context.read<NotificationsCubit>().markRead(n.id);
          final route = _resolveRoute(n);
          if (route != null) context.push(route);
        },
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: unread ? homeTintBorder(context) : colors.hairline)),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(color: s.color.withValues(alpha: 0.13), borderRadius: BorderRadius.circular(14)),
                child: Icon(s.icon, size: 21, color: s.color),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(title, style: TextStyle(fontSize: 13.5, fontWeight: unread ? FontWeight.w800 : FontWeight.w700, color: colors.inkStrong))),
                    if (unread)
                      Container(width: 9, height: 9, margin: const EdgeInsetsDirectional.only(start: 6), decoration: const BoxDecoration(color: AppPalette.gold500, shape: BoxShape.circle)),
                  ]),
                  if (body != null) ...[
                    const SizedBox(height: 2),
                    Text(body, maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, height: 1.55, color: colors.inkMuted)),
                  ],
                  if (n.createdAt != null) ...[
                    const SizedBox(height: 4),
                    Text(_ago(context, n.createdAt!), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                  ],
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 520,
      child: AppSkeletonizer(
        enabled: true,
        child: ListView.separated(
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.md),
          itemCount: 5,
          separatorBuilder: (_, _) => const SizedBox(height: 9),
          itemBuilder: (context, _) => Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: context.appColors.surface, borderRadius: BorderRadius.circular(20)),
            child: Row(children: [
              Container(width: 42, height: 42, decoration: BoxDecoration(color: context.appColors.surfaceSoft, borderRadius: BorderRadius.circular(14))),
              const SizedBox(width: 11),
              const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Notification title'), Text('Notification body text here')])),
            ]),
          ),
        ),
      ),
    );
  }
}
