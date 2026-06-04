import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../favorites/presentation/favorites_cubit.dart';
import '../../../notifications/presentation/unread_count_cubit.dart';
import '../widgets/catalog_skeletons.dart';
import '../widgets/project_card.dart';
import '../widgets/section_header.dart';
import 'home_cubit.dart';

/// The الرئيسية tab. For a signed-in customer it is a premium dashboard
/// (identity greeting + live summary tiles + quick actions) above the featured
/// projects; for guests it stays the marketing hero + featured + CTAs.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state;
    final isCustomer = session.isAuthenticated && session.role.isCustomerSide;

    // Body-only: the persistent CustomerShellScaffold supplies the app bar
    // (title, notification bell, language/theme toggles, avatar) + bottom nav.
    return RefreshIndicator(
      onRefresh: () => context.read<HomeCubit>().load(),
      child: ListView(
        // Bottom clearance so content clears the iOS floating tab bar
        // (extendBody); 0 on Android.
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).padding.bottom),
        children: [
          if (isCustomer) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                0,
              ),
              child: _CustomerDashboard(
                name: session.sessionOrNull?.displayName ??
                    session.sessionOrNull?.email,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
          ] else ...[
            const _Hero(),
            const SizedBox(height: AppSpacing.xl),
          ],
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            child: SectionHeader(
              title: l10n.homeFeaturedProjects,
              onViewAll: () => context.push('/projects'),
            ),
          ),
          const _FeaturedProjects(),
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }
}

/// Quick-action destination used by the dashboard grid.
class _QuickAction {
  const _QuickAction(this.icon, this.tone, this.label, this.route);
  final IconData icon;
  final AppTone tone;
  final String label;
  final String route;
}

/// Premium authenticated-customer overview: identity greeting, two live
/// summary tiles (unread notifications + favorites — both already loaded
/// app-wide), and a quick-actions grid into the account areas. No new API
/// calls; counts come from existing app-wide cubits and degrade gracefully.
class _CustomerDashboard extends StatelessWidget {
  const _CustomerDashboard({required this.name});

  final String? name;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    final actions = <_QuickAction>[
      _QuickAction(AppIcons.property, AppTone.gold, l10n.accountMyProperty, '/account/property'),
      _QuickAction(AppIcons.installments, AppTone.navy, l10n.installmentsTitle, '/account/installments'),
      _QuickAction(AppIcons.deposit, AppTone.gold, l10n.accountDeposits, '/account/deposits'),
      _QuickAction(AppIcons.contract, AppTone.success, l10n.accountContracts, '/account/contracts'),
      _QuickAction(AppIcons.maintenance, AppTone.navy, l10n.accountMaintenance, '/account/maintenance'),
      _QuickAction(AppIcons.visit, AppTone.gold, l10n.navVisits, '/account/requests'),
    ];

    return StaggeredColumn(
      spacing: AppSpacing.lg,
      children: [
        // ── Identity greeting ──────────────────────────────────────────────
        PremiumCard(
          glow: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.dashboardWelcome,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: context.appColors.brandGold,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: AppSpacing.xs),
              GradientAvatar.identity(
                name: name ?? l10n.accountRoleCustomer,
                role: l10n.accountRoleCustomer,
              ),
            ],
          ),
        ),

        // ── Live overview tiles ───────────────────────────────────────────
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSectionHeader(title: l10n.dashboardOverview),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: BlocBuilder<UnreadCountCubit, int>(
                    builder: (context, count) => SummaryTile(
                      icon: AppIcons.notification,
                      value: '$count',
                      label: l10n.accountNotifications,
                      onTap: () => context.push('/account/notifications'),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: BlocBuilder<FavoritesCubit, FavoritesState>(
                    builder: (context, state) => SummaryTile(
                      icon: AppIcons.favorite,
                      value: '${state.items.length}',
                      label: l10n.accountFavorites,
                      loading: state.status == DataStatus.loading,
                      onTap: () => context.push('/account/favorites'),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),

        // ── Quick actions ─────────────────────────────────────────────────
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSectionHeader(title: l10n.dashboardQuickActions),
            const SizedBox(height: AppSpacing.sm),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: AppSpacing.sm,
              crossAxisSpacing: AppSpacing.sm,
              childAspectRatio: 1.7,
              children: [
                for (final a in actions)
                  PremiumCard(
                    elevation: AppCardElevation.soft,
                    onTap: () => context.push(a.route),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconChip(icon: a.icon, tone: a.tone),
                        Text(
                          a.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                color: context.appColors.inkStrong,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

/// Premium floating hero banner: a rounded navy card with a gold ambient glow,
/// an eyebrow + display title + gold accent line + subtitle, and a luxe search
/// pill with a gold search chip.
class _Hero extends StatelessWidget {
  const _Hero();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final rtl = Directionality.of(context) == TextDirection.rtl;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, 0),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: Stack(
          children: [
            // Base navy gradient.
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppPalette.navy700, AppPalette.navy],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
            ),
            // Gold ambient glow in the top-end corner.
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: (rtl ? Alignment.topLeft : Alignment.topRight),
                      radius: 1.05,
                      colors: [
                        AppPalette.gold400.withValues(alpha: 0.24),
                        AppPalette.gold400.withValues(alpha: 0.0),
                      ],
                      stops: const [0.0, 0.62],
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: AppPalette.gold400,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        l10n.homeHeroEyebrow,
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: AppPalette.gold300,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    l10n.homeHeroTitle,
                    style: theme.textTheme.displaySmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Container(
                    width: 52,
                    height: 3,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppPalette.gold300, AppPalette.gold500],
                      ),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    l10n.homeHeroSubtitle,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.78),
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const _HeroSearch(),
                ],
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.03, end: 0);
  }
}

/// Luxe search entry: a white pill with a soft lift and a gold search chip.
class _HeroSearch extends StatelessWidget {
  const _HeroSearch();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Material(
      color: colors.surface,
      borderRadius: AppRadii.pillAll,
      clipBehavior: Clip.antiAlias,
      elevation: 8,
      shadowColor: Colors.black.withValues(alpha: 0.25),
      child: InkWell(
        onTap: () => context.push('/projects'),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xs),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppPalette.gold300, AppPalette.gold500],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: Icon(Icons.search_rounded, color: colors.brandNavy, size: 20),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  l10n.homeSearchHint,
                  style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
            ],
          ),
        ),
      ),
    );
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
              // Fits the luxury card (16:9 image + city + title + 2-line
              // description + units/arrow row) without vertical overflow.
              height: 350,
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

