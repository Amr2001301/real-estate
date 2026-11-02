import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../unread_count_cubit.dart';

/// The bell of every header in the customer app: the same glass button as
/// the other header actions (and as the staff app's bell), with the live
/// unread count. Tapping opens the notifications screen.
class CustomerNotificationButton extends StatelessWidget {
  const CustomerNotificationButton({super.key, this.size = 40});

  /// Kept for existing call sites; every header button is 40px.
  final double size;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BlocBuilder<UnreadCountCubit, int>(
      builder: (context, count) => NavHeaderAction(
        icon: AppIcons.notification,
        tooltip: l10n.accountNotifications,
        onTap: () => context.push('/account/notifications'),
        badge: count > 0 ? NavHeaderBadge(count: count) : null,
      ),
    );
  }
}
