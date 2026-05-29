import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/unread_count_cubit.dart';

/// AppBar action that opens the notifications inbox. Shows a small unread
/// count badge driven by [UnreadCountCubit]. Use on shell-level AppBars
/// (Sales Dashboard, Broker Dashboard).
class NotificationsBell extends StatelessWidget {
  const NotificationsBell({super.key, this.route = '/notifications'});

  final String route;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final unread = context.watch<UnreadCountCubit>().state;
    final colors = context.appColors;

    return IconButton(
      tooltip: l10n.accountNotifications,
      onPressed: () => context.push(route),
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(Icons.notifications_none_rounded),
          if (unread > 0)
            Positioned(
              top: -4,
              right: -4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                decoration: BoxDecoration(
                  color: colors.brandGold,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  unread > 99 ? '99+' : '$unread',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    height: 1.1,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
