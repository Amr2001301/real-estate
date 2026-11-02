import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/unread_count_cubit.dart';

/// The bell of every header in the staff app: the same glass button as the
/// other header actions (and as the customer app's bell), with the live
/// unread count.
class NotificationsBell extends StatelessWidget {
  const NotificationsBell({super.key, this.route = '/notifications'});

  final String route;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BlocBuilder<UnreadCountCubit, int>(
      builder: (context, count) => NavHeaderAction(
        icon: AppIcons.notification,
        tooltip: l10n.accountNotifications,
        onTap: () => context.push(route),
        badge: count > 0 ? NavHeaderBadge(count: count) : null,
      ),
    );
  }
}
