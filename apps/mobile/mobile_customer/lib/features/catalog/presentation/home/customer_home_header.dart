import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../notifications/presentation/unread_count_cubit.dart';

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
              child: GradientAvatar(name: name, size: 52),
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
            const _NotificationButton(),
          ],
        ),
      ),
    );
  }
}

/// A contained, premium notification control: a circular surface chip (hairline
/// + soft shadow) with the bell and a live gold unread badge — so it reads as an
/// intentional control rather than a bare floating glyph.
class _NotificationButton extends StatelessWidget {
  const _NotificationButton();

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
                    width: 46,
                    height: 46,
                    child: Stack(
                      clipBehavior: Clip.none,
                      alignment: Alignment.center,
                      children: [
                        Icon(
                          AppIcons.notification,
                          size: 22,
                          color: colors.inkStrong,
                        ),
                        if (hasBadge)
                          PositionedDirectional(
                            top: 9,
                            end: 9,
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
