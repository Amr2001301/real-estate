import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../unread_count_cubit.dart';

/// Premium notification control: a circular surface chip (hairline + soft
/// shadow) with the bell and a live gold unread badge. Tapping opens the
/// notifications screen. Shared by the customer app bar and the home header so
/// the control reads the same everywhere — never a bare floating glyph.
class CustomerNotificationButton extends StatelessWidget {
  const CustomerNotificationButton({super.key, this.size = 44});

  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n = context.l10n;

    return BlocBuilder<UnreadCountCubit, int>(
      builder: (context, count) {
        final hasBadge = count > 0;
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
                  onTap: () => context.push('/account/notifications'),
                  child: SizedBox(
                    width: size,
                    height: size,
                    child: Stack(
                      clipBehavior: Clip.none,
                      alignment: Alignment.center,
                      children: [
                        Icon(
                          AppIcons.notification,
                          size: size * 0.48,
                          color: colors.inkStrong,
                        ),
                        if (hasBadge)
                          PositionedDirectional(
                            top: size * 0.2,
                            end: size * 0.2,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                              ),
                              constraints: const BoxConstraints(
                                minWidth: 16,
                                minHeight: 16,
                              ),
                              decoration: BoxDecoration(
                                color: colors.brandGold,
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: colors.surface,
                                  width: 1.5,
                                ),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                count > 9 ? '9+' : '$count',
                                style: TextStyle(
                                  color: colors.brandNavy,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  height: 1,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
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
