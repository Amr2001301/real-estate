import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:go_router/go_router.dart';

import '../../../notifications/presentation/widgets/customer_notification_button.dart';

/// Premium in-body header for the authenticated CUSTOMER Home.
///
/// The shell AppBar is suppressed for the customer Home branch (see
/// `customer_shell_scaffold.dart`), so this header renders the identity +
/// notification + profile cluster itself — with the top safe-area inset baked
/// in. A warm greeting eyebrow + name + owner status sit beside the avatar
/// (which opens the profile); the notification entry is a contained circular
/// control (not an orphaned bare bell). No new data: name comes from the
/// session, the unread badge from the app-wide [UnreadCountCubit].
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
          topInset + AppSpacing.md,
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
                    l10n.dashboardWelcome,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: colors.brandGold,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
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
            const CustomerNotificationButton(size: 46),
          ],
        ),
      ),
    );
  }
}
