import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/entities/app_notification.dart';
import 'notifications_cubit.dart';
import 'unread_count_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

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
                        itemCount: items.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (_, i) => _NotificationTile(
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
              color: Color(0x35000000),
              blurRadius: 22,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            const Positioned.fill(
              child: IgnorePointer(child: _DotTexture()),
            ),
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 160,
                height: 130,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.09),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
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
                      AppPalette.gold400.withValues(alpha: 0.5),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                topInset + AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _BackBtn(),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.accountNotifications,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                        if (unreadCount > 0) ...[
                          const SizedBox(height: 4),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  color: AppPalette.gold300,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                '$unreadCount '
                                '${unreadCount == 1 ? 'إشعار جديد' : 'إشعارات جديدة'}',
                                style: const TextStyle(
                                  color: AppPalette.gold300,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (canMarkAll) ...[
                    const SizedBox(width: AppSpacing.sm),
                    GestureDetector(
                      onTap: onMarkAll,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 11,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.2),
                          ),
                        ),
                        child: Text(
                          l10n.markAllRead,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
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

/// Resolves the in-app navigation route for a notification based on
/// templateCode and payload fields (entityType / entityId). Returns null
/// when no specific screen is applicable (notification stays as-is).
String? _resolveRoute(AppNotification n) {
  final code = n.templateCode;
  final entityId = n.payload['entityId'] as String?;
  final entityType = n.payload['entityType'] as String?;

  // Maintenance
  if (code.startsWith('maintenance_')) {
    final id = entityId ?? n.payload['requestId'] as String?;
    if (id != null && id.isNotEmpty) return '/account/maintenance/$id';
    return '/account/maintenance';
  }
  // Contracts
  if (code.startsWith('contract_') || code == 'broker_contract_signed' || code == 'broker_contract_created') {
    final id = entityId ?? n.payload['contractId'] as String?;
    if (id != null && id.isNotEmpty) return '/account/contracts/$id';
    return '/account/contracts';
  }
  // Deposits
  if (code.startsWith('deposit_') || code == 'payment_proof_approved' || code == 'payment_proof_rejected') {
    final id = entityId ?? n.payload['depositId'] as String?;
    if (id != null && id.isNotEmpty) return '/account/deposits/$id';
    return '/account/deposits';
  }
  // Installments / payment proofs
  if (code.startsWith('installment_') || code.startsWith('payment_proof_') || code == 'booking_payment_proof_submitted') {
    final id = entityId;
    if (id != null && id.isNotEmpty) return '/account/installments/$id/proof';
    return '/account/installments';
  }
  // Visits / appointments
  if (code.startsWith('visit_')) {
    return '/account/requests';
  }
  // Reservations / finance
  if (code.startsWith('reservation_')) {
    return '/account/finance';
  }
  // Entity type fallback
  if (entityType == 'maintenance' && entityId != null) return '/account/maintenance/$entityId';
  if (entityType == 'contract' && entityId != null) return '/account/contracts/$entityId';
  if (entityType == 'deposit' && entityId != null) return '/account/deposits/$entityId';

  return null;
}

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
    final (iconBg, iconFg) = _iconStyle;

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
                          border: Border.all(
                            color: iconFg.withValues(alpha: 0.25),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: iconFg.withValues(alpha: 0.18),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
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
                                  fontSize: 11,
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

class _BackBtn extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.white,
          size: 16,
        ),
      ),
    );
  }
}

class _DotTexture extends StatelessWidget {
  const _DotTexture();

  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04);
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
