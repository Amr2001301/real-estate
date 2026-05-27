import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../domain/entities/project.dart';
import '../widgets/amenity_chips.dart';
import '../widgets/contact_buttons.dart';
import '../widgets/image_gallery.dart';
import '../widgets/section_header.dart';
import '../widgets/unit_card.dart';
import 'project_details_cubit.dart';

class ProjectDetailsScreen extends StatelessWidget {
  const ProjectDetailsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ProjectDetailsCubit, ProjectDetailsState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return const _LoadingScaffold();
          case DataStatus.failure:
          case DataStatus.empty:
            return Scaffold(
              appBar: AppBar(),
              body: ErrorState(
                failure: state.failure,
                onRetry: () => context.read<ProjectDetailsCubit>().load(),
              ),
            );
          case DataStatus.success:
            return _Content(state: state);
        }
      },
    );
  }
}

class _LoadingScaffold extends StatelessWidget {
  const _LoadingScaffold();
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: const Center(child: CircularProgressIndicator()),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.state});
  final ProjectDetailsState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final project = state.project!;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 300,
            pinned: true,
            actions: [FavoriteToggleButton(isProject: true, id: project.id)],
            flexibleSpace: FlexibleSpaceBar(
              background: ImageGallery(images: project.galleryImages),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(project.name.resolve(lang),
                            style: theme.textTheme.headlineMedium),
                      ),
                      if (project.featured)
                        const StatusBadge(label: 'FEATURED', tone: BadgeTone.gold),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    children: [
                      Icon(Icons.location_on_rounded,
                          size: 18, color: colors.brandGold),
                      const SizedBox(width: AppSpacing.xxs),
                      Text(project.city, style: theme.textTheme.bodyLarge),
                      const Spacer(),
                      Text(
                        l10n.availableUnitsCount(project.availableUnitsCount),
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: colors.inkMuted),
                      ),
                    ],
                  ),

                  if (!project.description.isEmpty) ...[
                    const SizedBox(height: AppSpacing.xl),
                    Text(l10n.aboutProject, style: theme.textTheme.titleLarge),
                    const SizedBox(height: AppSpacing.xs),
                    Text(project.description.resolve(lang),
                        style: theme.textTheme.bodyMedium),
                  ],

                  if (project.services.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.xl),
                    Text(l10n.projectAmenities, style: theme.textTheme.titleLarge),
                    const SizedBox(height: AppSpacing.sm),
                    AmenityChips(services: project.services),
                  ],

                  if (project.hasLocation) ...[
                    const SizedBox(height: AppSpacing.xl),
                    _LocationCard(project: project),
                  ],
                ],
              ),
            ),
          ),

          if (state.previewUnits.isNotEmpty)
            SliverToBoxAdapter(child: _UnitsPreview(state: state)),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                children: [
                  AppButton(
                    label: l10n.viewUnits,
                    icon: Icons.grid_view_rounded,
                    variant: AppButtonVariant.gold,
                    expand: true,
                    onPressed: () =>
                        context.push('/projects/${project.id}/units'),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppButton(
                    label: l10n.requestVisit,
                    icon: Icons.event_available_outlined,
                    variant: AppButtonVariant.outline,
                    expand: true,
                    onPressed: () {
                      final authed =
                          context.read<SessionCubit>().state.isAuthenticated;
                      if (authed) {
                        context.push('/visit-request',
                            extra: {'projectId': project.id});
                      } else {
                        context.push('/login');
                      }
                    },
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  ContactButtons(
                    whatsappMessage: project.name.resolve(lang),
                  ),
                  const SizedBox(height: AppSpacing.xxl),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LocationCard extends StatelessWidget {
  const _LocationCard({required this.project});
  final ProjectDetail project;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    return AppCard(
      child: Row(
        children: [
          Icon(Icons.map_outlined, color: colors.brandGold),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.projectLocation,
                    style: Theme.of(context).textTheme.titleMedium),
                Text(project.city,
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: colors.inkMuted)),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: () => ContactActions.openMap(
              lat: project.lat!,
              lng: project.lng!,
              label: project.name.resolve(lang),
            ),
            icon: const Icon(Icons.open_in_new_rounded, size: 18),
            label: Text(l10n.openInMaps),
          ),
        ],
      ),
    );
  }
}

class _UnitsPreview extends StatelessWidget {
  const _UnitsPreview({required this.state});
  final ProjectDetailsState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final project = state.project!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          child: SectionHeader(
            title: l10n.projectAvailableUnits,
            onViewAll: () => context.push('/projects/${project.id}/units'),
          ),
        ),
        SizedBox(
          height: 320,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            itemCount: state.previewUnits.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
            itemBuilder: (context, i) {
              final unit = state.previewUnits[i];
              return UnitCard(
                unit: unit,
                width: 280,
                onTap: () => context.push('/units/${unit.id}'),
              );
            },
          ),
        ),
      ],
    );
  }
}
