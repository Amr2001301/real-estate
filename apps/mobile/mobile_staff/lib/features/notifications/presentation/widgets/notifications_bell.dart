import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/unread_count_cubit.dart';

/// Premium notification control for the Staff app: a circular surface chip
/// (hairline + soft shadow) with the bell and a live gold unread badge.
/// Mirrors [CustomerNotificationButton] from the Customer app — same visual
/// language, same badge style, staff-specific route.
class NotificationsBell extends StatelessWidget {
  const NotificationsBell({super.key, this.route = '/notifications'});

  final String route;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n = context.l10n;

    return BlocBuilder<UnreadCountCubit, int>(
      builder: (context, count) {
        return Semantics(
          button: true,
          label: l10n.accountNotifications,
          child: Tooltip(
            message: l10n.accountNotifications,
            child: Container(
              decoration: BoxDecoration(
                color: colors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: colors.hairline),
                boxShadow: colors.shadowSoft,
              ),
              child: Material(
                color: Colors.transparent,
                shape: const CircleBorder(),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => context.push(route),
                  child: const SizedBox(
                    width: 40,
                    height: 40,
                    child: _BellContent(),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _BellContent extends StatelessWidget {
  const _BellContent();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final count = context.watch<UnreadCountCubit>().state;
    final hasBadge = count > 0;

    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        Icon(AppIcons.notification, size: 20, color: colors.inkStrong),
        if (hasBadge)
          PositionedDirectional(
            top: 8,
            end: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
              decoration: BoxDecoration(
                color: colors.brandGold,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: colors.surface, width: 1.5),
              ),
              alignment: Alignment.center,
              child: Text(
                count > 9 ? '9+' : '$count',
                style: TextStyle(
                  color: colors.brandNavy,
                  fontSize: 8.5,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
