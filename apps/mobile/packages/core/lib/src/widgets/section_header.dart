import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_spacing.dart';

/// A reusable section title block mirroring the website's SectionHeading:
/// optional gold eyebrow, a title, an optional subtitle, and an optional
/// trailing action (e.g. a "see all" button). RTL-safe.
///
/// Named [AppSectionHeader] (not `SectionHeader`) to avoid colliding with
/// feature-local section-header widgets in the apps.
class AppSectionHeader extends StatelessWidget {
  const AppSectionHeader({
    super.key,
    required this.title,
    this.eyebrow,
    this.subtitle,
    this.action,
  });

  final String title;
  final String? eyebrow;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (eyebrow != null && eyebrow!.isNotEmpty) ...[
          Text(
            eyebrow!,
            style: theme.textTheme.labelMedium?.copyWith(
              color: colors.brandGold,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
        ],
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Text(
                title,
                style: theme.textTheme.titleLarge?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (action != null) ...[
              const SizedBox(width: AppSpacing.sm),
              action!,
            ],
          ],
        ),
        if (subtitle != null && subtitle!.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xxs),
          Text(
            subtitle!,
            style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted),
          ),
        ],
      ],
    );
  }
}

/// A lightweight section wrapper: a [SectionHeader] followed by [child] with
/// consistent vertical rhythm. Optional — screens can use [SectionHeader] alone.
class AppSection extends StatelessWidget {
  const AppSection({
    super.key,
    required this.title,
    required this.child,
    this.eyebrow,
    this.subtitle,
    this.action,
    this.gap = AppSpacing.md,
  });

  final String title;
  final Widget child;
  final String? eyebrow;
  final String? subtitle;
  final Widget? action;
  final double gap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppSectionHeader(
          title: title,
          eyebrow: eyebrow,
          subtitle: subtitle,
          action: action,
        ),
        SizedBox(height: gap),
        child,
      ],
    );
  }
}
