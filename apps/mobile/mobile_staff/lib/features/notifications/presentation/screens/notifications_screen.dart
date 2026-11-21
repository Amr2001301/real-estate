import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/app_notification.dart';
import '../cubit/notifications_cubit.dart';
import '../cubit/unread_count_cubit.dart';
import '../notification_route.dart';

enum _Filter { all, unread, finance, sales }

/// The notification's family: what the filters tell apart.
_Filter _familyOf(String code) {
  const finance = ['deposit_', 'installment_', 'cheque_', 'payment_', 'booking_payment_', 'bonus_', 'refund_', 'broker_commission_', 'broker_payout_'];
  const sales = ['lead_', 'broker_lead_', 'visit_', 'reservation_', 'contract_', 'follow_up'];
  if (finance.any(code.startsWith)) return _Filter.finance;
  if (sales.any(code.startsWith)) return _Filter.sales;
  return _Filter.all;
}

/// The icon and tint of a notification (design n1, owner-approved 2026-11-05).
({IconData icon, Color color}) _style(String code) {
  if (code.startsWith('visit_')) return (icon: Icons.event_rounded, color: const Color(0xFF26405F));
  if (code.startsWith('reservation_')) return (icon: Icons.bookmark_rounded, color: const Color(0xFF2F6B4A));
  if (code.startsWith('maintenance_')) return (icon: Icons.build_rounded, color: const Color(0xFF8A5A12));
  if (code.startsWith('payment_') || code.startsWith('booking_payment_') || code.startsWith('deposit_')) return (icon: Icons.payments_rounded, color: AppPalette.gold600);
  if (code.startsWith('cheque_')) return (icon: Icons.receipt_long_rounded, color: const Color(0xFFB3261E));
  if (code.startsWith('installment_')) return (icon: Icons.calendar_month_rounded, color: const Color(0xFF8A5A12));
  if (code.startsWith('bonus_') || code.startsWith('broker_commission_') || code.startsWith('broker_payout_')) return (icon: Icons.savings_rounded, color: const Color(0xFF2F6B4A));
  if (code.startsWith('lead_') || code.startsWith('broker_lead_')) return (icon: Icons.person_add_alt_1_rounded, color: const Color(0xFF26405F));
  if (code.startsWith('contract_')) return (icon: Icons.description_rounded, color: AppPalette.gold600);
  return (icon: Icons.campaign_rounded, color: AppPalette.gold600);
}

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
    final isAdmin = context.read<SessionCubit>().state.role == AppRole.admin;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocConsumer<NotificationsCubit, NotificationsState>(
          listenWhen: (a, b) => b.status == DataStatus.success || b.status == DataStatus.empty,
          listener: (context, _) => context.read<UnreadCountCubit>().load(),
          builder: (context, state) {
            final all = state.data ?? const <AppNotification>[];
            final ready = state.status == DataStatus.success || state.status == DataStatus.empty;
            final unread = all.where((n) => !n.read).length;
            final shown = all.where(_matches).toList();
            int count(_Filter f) => all.where((n) => f == _Filter.unread ? !n.read : _familyOf(n.templateCode) == f).length;
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
                        if (isAdmin) HomeHeroButton(key: const Key('notifications-send'), icon: Icons.campaign_rounded, tooltip: l10n.ntSend, onTap: () => context.push('/notifications/send')),
                        HomeHeroButton(key: const Key('notifications-prefs'), icon: Icons.tune_rounded, tooltip: l10n.ntPrefs, onTap: () => context.push('/notifications/preferences')),
                        if (unread > 0) HomeHeroButton(key: const Key('notifications-read-all'), icon: Icons.done_all_rounded, tooltip: l10n.markAllRead, onTap: cubit.markAllRead),
                      ],
                    ),
                  ),
                  if (ready && all.isNotEmpty)
                    SliverToBoxAdapter(
                      child: DvTabs<_Filter>(
                        keyPrefix: 'notifications-filter',
                        selected: _filter,
                        onChanged: (f) => setState(() => _filter = _filter == f ? _Filter.all : f),
                        tabs: [
                          (_Filter.all, l10n.ntAll, null, false),
                          (_Filter.unread, l10n.ntUnread, unread == 0 ? null : unread, false),
                          (_Filter.finance, l10n.ntFinance, count(_Filter.finance) == 0 ? null : count(_Filter.finance), false),
                          (_Filter.sales, l10n.ntSales, count(_Filter.sales) == 0 ? null : count(_Filter.sales), false),
                        ],
                      ),
                    ),
                  ...switch (state.status) {
                    DataStatus.initial || DataStatus.loading when all.isEmpty => [const SliverToBoxAdapter(child: _Skeleton())],
                    DataStatus.failure when all.isEmpty => [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: cubit.load))],
                    DataStatus.empty => [SliverToBoxAdapter(child: EmptyState(icon: Icons.notifications_none_rounded, title: l10n.notificationsEmptyTitle, message: l10n.notificationsEmptyMessage))],
                    _ when shown.isEmpty => [SliverToBoxAdapter(child: EmptyState(icon: Icons.filter_list_off_rounded, title: l10n.ntNoMatch))],
                    _ => [
                        ..._days(context, shown),
                        if (cubit.hasMore) SliverToBoxAdapter(child: Center(child: TextButton(onPressed: cubit.loadMore, child: Text(l10n.showMore)))),
                      ],
                  },
                  SliverPadding(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24)),
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

    final groups = <String, List<AppNotification>>{};
    for (final n in items) {
      final at = n.createdAt?.toLocal();
      (groups[at == null ? '' : label(at)] ??= []).add(n);
    }
    return [
      for (final e in groups.entries) ...[
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 22, AppSpacing.lg, 10),
            child: Text(e.key, style: TextStyle(fontSize: 16, height: 1.4, fontWeight: FontWeight.w700, color: colors.inkStrong)),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          sliver: SliverToBoxAdapter(
            child: Container(
              decoration: homeCard(context, radius: 22),
              clipBehavior: Clip.antiAlias,
              child: Material(
                color: Colors.transparent,
                child: Column(children: [
                  for (var i = 0; i < e.value.length; i++) ...[
                    if (i > 0) Divider(height: 1, thickness: 1, indent: 16, endIndent: 16, color: colors.hairline),
                    _Tile(e.value[i]),
                  ],
                ]),
              ),
            ),
          ),
        ),
      ],
    ];
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
    return InkWell(
      key: Key('notification-${n.id}'),
      onTap: () {
        if (unread) context.read<NotificationsCubit>().markRead(n.id);
        final isBroker = context.read<SessionCubit>().state.role == AppRole.broker;
        final route = staffNotificationRoute(n.templateCode, n.payload, isBroker: isBroker);
        if (route != null) context.push(route);
      },
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
            child: Icon(s.icon, size: 20, color: s.color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: TextStyle(fontSize: 14, height: 1.5, fontWeight: unread ? FontWeight.w700 : FontWeight.w600, color: colors.inkStrong)),
              if (body != null) ...[
                const SizedBox(height: 3),
                Text(body, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, height: 1.5, color: colors.inkMuted)),
              ],
            ]),
          ),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            if (n.createdAt != null) Text(_ago(context, n.createdAt!), style: TextStyle(fontSize: 11.5, color: colors.inkMuted)),
            if (unread)
              Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 8), decoration: BoxDecoration(color: AppPalette.gold500, shape: BoxShape.circle)),
          ]),
        ]),
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
