import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/project.dart';
import '../../domain/entities/unit.dart';

import 'project_card.dart';
import 'unit_card.dart';

const _dummyProject = ProjectListItem(
  id: '0',
  name: Translatable(ar: 'مشروع تجريبي', en: 'Placeholder Project'),
  description: Translatable(
    ar: 'مجمع سكني فاخر بمساحات خضراء واسعة ومرافق متكاملة.',
    en: 'A premium residential community with green spaces.',
  ),
  city: 'الرياض',
  services: [],
  featured: true,
  availableUnitsCount: 12,
);

const _dummyUnit = Unit(
  id: '0',
  code: 'SH-000',
  type: '2BR',
  area: 180,
  bedrooms: 3,
  bathrooms: 2,
  floor: 3,
  price: '5800000',
  status: UnitStatus.available,
  project: UnitProjectRef(
    id: '0',
    name: Translatable(ar: 'سولارا هايتس', en: 'Placeholder Project'),
    city: 'الرياض',
  ),
);

/// 1-column list skeleton mirroring the real project list (same `ListView`,
/// same cards) so the loading state matches the loaded UI exactly.
class ProjectsGridSkeleton extends StatelessWidget {
  const ProjectsGridSkeleton({super.key, this.itemCount = 4});
  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.lg),
        physics: const NeverScrollableScrollPhysics(),
        itemCount: itemCount,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
        itemBuilder: (_, _) => const ProjectCard(project: _dummyProject),
      ),
    );
  }
}

/// 1-column list skeleton mirroring the real unit list.
class UnitsGridSkeleton extends StatelessWidget {
  const UnitsGridSkeleton({super.key, this.itemCount = 4});
  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.lg),
        physics: const NeverScrollableScrollPhysics(),
        itemCount: itemCount,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
        itemBuilder: (_, _) => const UnitCard(unit: _dummyUnit),
      ),
    );
  }
}

/// Horizontal featured-projects skeleton for the home screen — matches the live
/// carousel height (350) and card width (300).
class FeaturedRowSkeleton extends StatelessWidget {
  const FeaturedRowSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: SizedBox(
        height: 350,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          itemCount: 3,
          separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
          itemBuilder: (_, _) =>
              const ProjectCard(project: _dummyProject, width: 300),
        ),
      ),
    );
  }
}
