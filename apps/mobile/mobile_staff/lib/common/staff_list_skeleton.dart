import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Consistent list loading placeholder for Staff list screens. Renders a few
/// card-shaped rows under [AppSkeletonizer] (which respects reduced-motion).
class StaffListSkeleton extends StatelessWidget {
  const StaffListSkeleton({super.key, this.rows = 6, this.lines = 2, this.band = false});

  final int rows;
  final int lines;

  /// The list's navy figures card above the rows (most list screens open with one).
  final bool band;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppSkeletonizer(
      enabled: true,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.lg),
        itemCount: rows + (band ? 1 : 0),
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, i) => band && i == 0
            ? Container(height: 92, decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(20)))
            : AppCard(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Placeholder title', style: theme.textTheme.titleSmall),
                    if (lines > 1) ...[
                      const SizedBox(height: 4),
                      Text('Placeholder secondary line', style: theme.textTheme.bodySmall),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              const StatusBadge(label: '••••', tone: BadgeTone.neutral),
            ],
          ),
        ),
      ),
    );
  }
}
