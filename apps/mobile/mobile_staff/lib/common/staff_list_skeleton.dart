import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Consistent list loading placeholder for Staff list screens. Renders a few
/// card-shaped rows under [AppSkeletonizer] (which respects reduced-motion).
class StaffListSkeleton extends StatelessWidget {
  const StaffListSkeleton({super.key, this.rows = 6, this.lines = 2});

  final int rows;
  final int lines;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppSkeletonizer(
      enabled: true,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.lg),
        itemCount: rows,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, _) => AppCard(
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
