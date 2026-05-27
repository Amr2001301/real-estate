import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';
import '../l10n/l10n.dart';

/// A centered empty placeholder: rounded icon tile, title, message, optional
/// action. Falls back to localized default copy when title/message are omitted.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    this.icon = Icons.inbox_outlined,
    this.title,
    this.message,
    this.action,
  });

  final IconData icon;
  final String? title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: colors.surfaceSoft,
                borderRadius: AppRadii.icon,
              ),
              child: Icon(icon, color: colors.inkMuted, size: 28),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              title ?? l10n.stateEmptyTitle,
              style: theme.textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              message ?? l10n.stateEmptyMessage,
              style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted),
              textAlign: TextAlign.center,
            ),
            if (action != null) ...[
              const SizedBox(height: AppSpacing.lg),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}
