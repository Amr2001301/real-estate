import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/project.dart';
import '../../domain/entities/unit.dart';

import 'project_card.dart';
import 'unit_card.dart';

final _dummyProject = const ProjectListItem(
  id: '0',
  name: Translatable(ar: 'مشروع تجريبي', en: 'Placeholder Project'),
  description: Translatable(ar: '', en: ''),
  city: 'City name',
  services: [],
  featured: false,
  availableUnitsCount: 12,
);

final _dummyUnit = Unit(
  id: '0',
  code: '000',
  type: 'Apartment',
  area: 180,
  bedrooms: 3,
  bathrooms: 2,
  price: '5800000',
  status: UnitStatus.available,
  project: const UnitProjectRef(
    id: '0',
    name: Translatable(ar: 'مشروع', en: 'Placeholder Project'),
    city: 'City',
  ),
);

/// Skeleton loaders that mirror the real card layouts (via Skeletonizer), so
/// the loading state matches the loaded UI exactly.
class ProjectsGridSkeleton extends StatelessWidget {
  const ProjectsGridSkeleton({super.key, this.itemCount = 4});
  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: GridView.builder(
        padding: const EdgeInsets.all(AppSpacing.lg),
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
          maxCrossAxisExtent: 360,
          mainAxisExtent: 280,
          crossAxisSpacing: AppSpacing.md,
          mainAxisSpacing: AppSpacing.md,
        ),
        itemCount: itemCount,
        itemBuilder: (_, _) => ProjectCard(project: _dummyProject),
      ),
    );
  }
}

class UnitsGridSkeleton extends StatelessWidget {
  const UnitsGridSkeleton({super.key, this.itemCount = 4});
  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: GridView.builder(
        padding: const EdgeInsets.all(AppSpacing.lg),
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
          maxCrossAxisExtent: 360,
          mainAxisExtent: 320,
          crossAxisSpacing: AppSpacing.md,
          mainAxisSpacing: AppSpacing.md,
        ),
        itemCount: itemCount,
        itemBuilder: (_, _) => UnitCard(unit: _dummyUnit),
      ),
    );
  }
}

/// Horizontal featured-projects skeleton for the home screen.
class FeaturedRowSkeleton extends StatelessWidget {
  const FeaturedRowSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: SizedBox(
        height: 280,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          itemCount: 3,
          separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
          itemBuilder: (_, _) =>
              ProjectCard(project: _dummyProject, width: 300),
        ),
      ),
    );
  }
}
