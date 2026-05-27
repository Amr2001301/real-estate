import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// A section title with an optional trailing "view all" action.
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.onViewAll});

  final String title;
  final VoidCallback? onViewAll;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Text(title, style: Theme.of(context).textTheme.headlineSmall),
          ),
          if (onViewAll != null)
            TextButton(
              onPressed: onViewAll,
              child: Text(context.l10n.viewAll),
            ),
        ],
      ),
    );
  }
}

/// A small icon + value chip used for unit specs (beds, baths, area).
class SpecChip extends StatelessWidget {
  const SpecChip({super.key, required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsetsDirectional.only(end: AppSpacing.md),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: colors.inkMuted),
          const SizedBox(width: AppSpacing.xxs),
          Text(value, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
