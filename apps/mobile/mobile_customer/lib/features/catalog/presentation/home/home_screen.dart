import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../favorites/presentation/favorites_cubit.dart';
import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../../notifications/presentation/unread_count_cubit.dart';
import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/project.dart';
import '../../domain/entities/unit.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../domain/usecases/get_units.dart';
import '../widgets/catalog_controls.dart';
import '../widgets/catalog_skeletons.dart';
import '../widgets/glass.dart';
import '../widgets/section_header.dart';
import '../widgets/unit_card.dart';
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
                name:
                    session.sessionOrNull?.displayName ??
                    session.sessionOrNull?.email,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
          ] else ...[
            const _Hero(),
            const SizedBox(height: AppSpacing.md),
            // Website-inspired search card (the hero no longer carries a button).
            const _HomeSearchCard(),
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
          const SizedBox(height: AppSpacing.xl),
          // Units preview (self-managing: renders its own header, hides if no
          // data). Shared by guest + customer as a discovery section.
          const _FeaturedUnits(),
          if (!isCustomer) ...[
            const SizedBox(height: AppSpacing.lg),
            const _HomeCtaBand(),
          ],
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
      _QuickAction(
        AppIcons.property,
        AppTone.gold,
        l10n.accountMyProperty,
        '/account/property',
      ),
      _QuickAction(
        AppIcons.installments,
        AppTone.navy,
        l10n.installmentsTitle,
        '/account/installments',
      ),
      _QuickAction(
        AppIcons.deposit,
        AppTone.gold,
        l10n.accountDeposits,
        '/account/deposits',
      ),
      _QuickAction(
        AppIcons.contract,
        AppTone.success,
        l10n.accountContracts,
        '/account/contracts',
      ),
      _QuickAction(
        AppIcons.maintenance,
        AppTone.navy,
        l10n.accountMaintenance,
        '/account/maintenance',
      ),
      _QuickAction(
        AppIcons.visit,
        AppTone.gold,
        l10n.navVisits,
        '/account/requests',
      ),
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
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
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
        AppSpacing.lg,
        AppSpacing.sm,
        AppSpacing.lg,
        0,
      ),
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
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
              ),
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
                ],
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.03, end: 0);
  }
}

/// Website-inspired Home search card: quick property-type search chips, a
/// premium search field, and a primary search action. Search routes to
/// `/projects?q=…` (projects support text query + city; the mobile units API
/// has no text search). The type chips are honest quick-search shortcuts, not a
/// backend category filter (mobile has none).
class _HomeSearchCard extends StatefulWidget {
  const _HomeSearchCard();

  @override
  State<_HomeSearchCard> createState() => _HomeSearchCardState();
}

class _HomeSearchCardState extends State<_HomeSearchCard> {
  late final TextEditingController _search;

  @override
  void initState() {
    super.initState();
    _search = TextEditingController();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _runSearch(String raw) {
    final query = raw.trim();
    context.push(
      query.isEmpty ? '/projects' : '/projects?q=${Uri.encodeQueryComponent(query)}',
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final types = [
      l10n.homeTypeResidential,
      l10n.homeTypeOffice,
      l10n.homeTypeCommercial,
      l10n.homeTypeMedical,
      l10n.homeTypeHotel,
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: PremiumCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 34,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: EdgeInsets.zero,
                itemCount: types.length,
                separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.xs),
                itemBuilder: (context, i) =>
                    _TypeChip(label: types[i], onTap: () => _runSearch(types[i])),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            CatalogSearchField(
              controller: _search,
              hint: l10n.homeSearchHint,
              onChanged: (_) => setState(() {}),
              onSubmitted: _runSearch,
              onClear: () {
                _search.clear();
                setState(() {});
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: l10n.homeSearchAction,
              icon: Icons.search_rounded,
              variant: AppButtonVariant.gold,
              expand: true,
              onPressed: () => _runSearch(_search.text),
            ),
          ],
        ),
      ),
    );
  }
}

/// A small tappable quick-search pill for the Home search card.
class _TypeChip extends StatelessWidget {
  const _TypeChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: colors.surfaceSoft,
      borderRadius: AppRadii.pillAll,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          child: Center(
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Compact premium lower CTA — a small navy band with a gold primary action and
/// a subtle secondary, not a tall web banner.
class _HomeCtaBand extends StatelessWidget {
  const _HomeCtaBand();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppPalette.navy700, AppPalette.navy],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(AppRadii.xl),
          boxShadow: colors.shadowCard,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.homeCtaTitle,
              style: theme.textTheme.titleMedium?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: AppSpacing.xxs),
            Text(
              l10n.homeCtaSubtitle,
              style: theme.textTheme.bodySmall?.copyWith(
                color: Colors.white.withValues(alpha: 0.78),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                AppButton(
                  label: l10n.homeCtaAction,
                  icon: Icons.chat_bubble_outline_rounded,
                  variant: AppButtonVariant.gold,
                  size: AppButtonSize.small,
                  onPressed: () => context.push('/chat'),
                ),
                const Spacer(),
                TextButton(
                  style: TextButton.styleFrom(foregroundColor: Colors.white),
                  onPressed: () => context.push('/units'),
                  child: Text(l10n.homeCtaSecondary),
                ),
              ],
            ),
          ],
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
            return _FeaturedProjectsCarousel(projects: state.data!);
        }
      },
    );
  }
}

/// Premium mobile projects carousel: a snapping [PageView] with the active card
/// prominent and adjacent cards peeking at the sides, plus a page-dot indicator.
/// RTL-aware (PageView follows the ambient text direction, like a ListView).
class _FeaturedProjectsCarousel extends StatefulWidget {
  const _FeaturedProjectsCarousel({required this.projects});

  final List<ProjectListItem> projects;

  @override
  State<_FeaturedProjectsCarousel> createState() =>
      _FeaturedProjectsCarouselState();
}

class _FeaturedProjectsCarouselState extends State<_FeaturedProjectsCarousel> {
  late final PageController _controller;
  Timer? _timer;
  int _page = 0;

  static const _interval = Duration(seconds: 5);

  @override
  void initState() {
    super.initState();
    _controller = PageController(viewportFraction: 0.86);
    _startAutoPlay();
  }

  void _startAutoPlay() {
    _timer?.cancel();
    if (widget.projects.length <= 1) return;
    _timer = Timer.periodic(_interval, (_) {
      if (!mounted || !_controller.hasClients) return;
      final count = widget.projects.length;
      if (count <= 1) return;
      final next = (_page + 1) % count;
      _controller.animateToPage(
        next,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeInOut,
      );
    });
  }

  void _pauseAutoPlay() => _timer?.cancel();

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final projects = widget.projects;
    return Column(
      children: [
        SizedBox(
          height: 260,
          // Pause auto-advance while the user is touching, resume after.
          child: Listener(
            onPointerDown: (_) => _pauseAutoPlay(),
            onPointerUp: (_) => _startAutoPlay(),
            onPointerCancel: (_) => _startAutoPlay(),
            child: PageView.builder(
              controller: _controller,
              itemCount: projects.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (context, i) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
                child: _HomeProjectCard(
                  project: projects[i],
                  onTap: () => context.push('/projects/${projects[i].id}'),
                ),
              ),
            ),
          ),
        ),
        if (projects.length > 1) ...[
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < projects.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _page ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: i == _page ? colors.brandGold : colors.hairline,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

/// "وحدات مختارة" — a small units preview carousel below projects. Fetches a
/// short page of available units via the existing [GetUnits] use case +
/// app-wide [CatalogRepository] (no new API). Renders its own header and hides
/// itself entirely when there's nothing to show.
class _FeaturedUnits extends StatefulWidget {
  const _FeaturedUnits();

  @override
  State<_FeaturedUnits> createState() => _FeaturedUnitsState();
}

class _FeaturedUnitsState extends State<_FeaturedUnits> {
  late final Future<Result<Paginated<Unit>>> _future;

  @override
  void initState() {
    super.initState();
    _future = GetUnits(context.read<CatalogRepository>())(
      const GetUnitsParams(status: UnitStatus.available, page: 1, pageSize: 6),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return FutureBuilder<Result<Paginated<Unit>>>(
      future: _future,
      builder: (context, snap) {
        if (!snap.hasData) return const SizedBox.shrink();
        final units = snap.data!.when(
          ok: (page) => page.data,
          err: (_) => const <Unit>[],
        );
        if (units.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: SectionHeader(
                title: l10n.homeFeaturedUnits,
                onViewAll: () => context.push('/units'),
              ),
            ),
            SizedBox(
              height: 320,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                itemCount: units.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: AppSpacing.md),
                itemBuilder: (context, i) => UnitCard(
                  unit: units[i],
                  width: 290,
                  onTap: () => context.push('/units/${units[i].id}'),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Home-only project showcase card: an IMAGE-ONLY overlay card (no white body)
/// — full cover image with a bottom scrim and the featured/city/title/units
/// composed on top, like the website's selected-project slider. Distinct from
/// the /projects list [ProjectCard]; that one is unchanged.
class _HomeProjectCard extends StatelessWidget {
  const _HomeProjectCard({required this.project, this.onTap});

  final ProjectListItem project;
  final VoidCallback? onTap;

  String _title(String lang) {
    final name = project.name.resolve(lang).trim();
    if (name.isNotEmpty) return name;
    final city = project.city.trim();
    return city.isNotEmpty ? city : '—';
  }

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;
    final city = project.city.trim();
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final radius = BorderRadius.circular(AppRadii.xl);

    return GestureDetector(
      onTap: onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: radius,
          boxShadow: colors.shadowCard,
        ),
        child: ClipRRect(
          borderRadius: radius,
          child: Stack(
            fit: StackFit.expand,
            children: [
              AppNetworkImage(url: project.coverImage),
              const ImageScrim(),
              if (project.featured)
                PositionedDirectional(
                  top: AppSpacing.sm,
                  start: AppSpacing.sm,
                  child: GlassPill(
                    child: Row(
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
                        Text(l10n.featuredBadge),
                      ],
                    ),
                  ),
                ),
              PositionedDirectional(
                top: AppSpacing.xs,
                end: AppSpacing.xs,
                child: GlassCircle(
                  child: FavoriteToggleButton(
                    isProject: true,
                    id: project.id,
                    dense: true,
                  ),
                ),
              ),
              PositionedDirectional(
                bottom: AppSpacing.lg,
                start: AppSpacing.lg,
                end: AppSpacing.lg,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (city.isNotEmpty)
                      Row(
                        children: [
                          const Icon(
                            Icons.location_on_rounded,
                            size: 14,
                            color: AppPalette.gold300,
                          ),
                          const SizedBox(width: AppSpacing.xxs),
                          Flexible(
                            child: Text(
                              city,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: Colors.white.withValues(alpha: 0.9),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      _title(lang),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        GlassPill(
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.apartment_rounded,
                                color: AppPalette.gold300,
                              ),
                              const SizedBox(width: AppSpacing.xs),
                              Text(
                                l10n.availableUnitsCount(
                                  project.availableUnitsCount,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(),
                        Icon(
                          rtl
                              ? Icons.chevron_left_rounded
                              : Icons.chevron_right_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
