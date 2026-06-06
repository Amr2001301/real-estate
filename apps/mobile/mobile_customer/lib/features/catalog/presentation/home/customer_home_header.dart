import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../notifications/presentation/unread_count_cubit.dart';
import '../../../shell/presentation/notification_bell.dart';

/// Premium in-body header for the authenticated CUSTOMER Home.
///
/// The shell AppBar is suppressed for the customer Home branch (see
/// `customer_shell_scaffold.dart`), so this header renders the identity +
/// notification + profile cluster itself — with the top safe-area inset baked
/// in. Replaces the generic centered toolbar title and the disconnected square
/// avatar. No new data: name comes from the session, the unread badge from the
/// app-wide [UnreadCountCubit].
class CustomerHomeHeader extends StatelessWidget {
  const CustomerHomeHeader({
    super.key,
    required this.name,
    required this.hasProperty,
  });

  final String? name;

  /// Drives the status line: `عميل · مالك وحدة` for an owner, else `عميل`.
  final bool hasProperty;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;
    // The shell AppBar is suppressed for this branch, so set the status-bar icon
    // contrast here: dark glyphs on the light canvas, light glyphs in dark mode.
    final dark = theme.brightness == Brightness.dark;
    final overlay = dark
        ? SystemUiOverlayStyle.light.copyWith(
            statusBarColor: Colors.transparent,
          )
        : SystemUiOverlayStyle.dark.copyWith(
            statusBarColor: Colors.transparent,
          );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: overlay,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          topInset + AppSpacing.sm,
          AppSpacing.lg,
          0,
        ),
        child: Row(
          children: [
            // Identity / profile entry.
            GestureDetector(
              onTap: () => context.push('/account/profile'),
              behavior: HitTestBehavior.opaque,
              child: GradientAvatar(name: name, size: 46),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    name ?? l10n.accountRoleCustomer,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  StatusBadge(
                    label: hasProperty
                        ? l10n.homeOwnerRole
                        : l10n.accountRoleCustomer,
                    tone: hasProperty ? BadgeTone.gold : BadgeTone.navy,
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            // Notification entry with live unread badge.
            BlocBuilder<UnreadCountCubit, int>(
              builder: (context, count) => NotificationBell(
                count: count,
                tooltip: l10n.accountNotifications,
                onTap: () => context.push('/account/notifications'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
