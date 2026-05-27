import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../widgets/catalog_skeletons.dart';
import '../widgets/project_card.dart';
import '../widgets/section_header.dart';
import 'home_cubit.dart';

/// Guest home: hero, search entry, featured projects, CTAs.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.customerAppTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.translate_rounded),
            tooltip: l10n.galleryToggleLanguage,
            onPressed: () => context.read<LocaleCubit>().toggle(),
          ),
          IconButton(
            icon: const Icon(Icons.brightness_6_outlined),
            tooltip: l10n.galleryToggleTheme,
            onPressed: () => context.read<ThemeCubit>().cycle(),
          ),
          IconButton(
            icon: const Icon(Icons.person_outline_rounded),
            tooltip: l10n.navAccount,
            onPressed: () => context.push('/account'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => context.read<HomeCubit>().load(),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const _Hero(),
            const SizedBox(height: AppSpacing.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: SectionHeader(
                title: l10n.homeFeaturedProjects,
                onViewAll: () => context.push('/projects'),
              ),
            ),
            const _FeaturedProjects(),
            const SizedBox(height: AppSpacing.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: _HomeCtas(),
            ),
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.xl, AppSpacing.lg, AppSpacing.xl),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [colors.brandNavy, colors.brandNavy.withValues(alpha: 0.82)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.homeHeroTitle,
            style: theme.textTheme.displaySmall?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.homeHeroSubtitle,
            style: theme.textTheme.bodyLarge
                ?.copyWith(color: Colors.white.withValues(alpha: 0.8)),
          ),
          const SizedBox(height: AppSpacing.lg),
          Material(
            color: colors.surface,
            borderRadius: AppRadii.pillAll,
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => context.push('/projects'),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md, vertical: AppSpacing.md),
                child: Row(
                  children: [
                    Icon(Icons.search_rounded, color: colors.inkMuted),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      l10n.homeSearchHint,
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(color: colors.inkMuted),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.04, end: 0);
  }
}

class _FeaturedProjects extends StatelessWidget {
  const _FeaturedProjects();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<HomeCubit, HomeState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return const FeaturedRowSkeleton();
          case DataStatus.failure:
            return SizedBox(
              height: 240,
              child: ErrorState(
                failure: state.failure,
                onRetry: () => context.read<HomeCubit>().load(),
              ),
            );
          case DataStatus.empty:
            return const SizedBox(height: 200, child: EmptyState());
          case DataStatus.success:
            final projects = state.data!;
            return SizedBox(
              height: 280,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                itemCount: projects.length,
                separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
                itemBuilder: (context, i) => ProjectCard(
                  project: projects[i],
                  width: 300,
                  onTap: () => context.push('/projects/${projects[i].id}'),
                ).animate().fadeIn(delay: (60 * i).ms, duration: 350.ms),
              ),
            );
        }
      },
    );
  }
}

class _HomeCtas extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      children: [
        AppButton(
          label: l10n.homeExploreProjects,
          icon: Icons.explore_outlined,
          variant: AppButtonVariant.gold,
          expand: true,
          onPressed: () => context.push('/projects'),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: l10n.homeAskAssistant,
          icon: Icons.chat_bubble_outline_rounded,
          variant: AppButtonVariant.outline,
          expand: true,
          onPressed: () => context.push('/chat'),
        ),
      ],
    );
  }
}
