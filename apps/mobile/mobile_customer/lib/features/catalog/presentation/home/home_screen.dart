import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../../installments/presentation/cubit/installments_cubit.dart';
import '../../../maintenance/presentation/maintenance_requests_cubit.dart';
import '../../../my_property/presentation/my_property_cubit.dart';
import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/project.dart';
import '../../domain/entities/unit.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../domain/usecases/get_units.dart';
import '../../../../common/brand_mark.dart';
import '../compare/compare_cubit.dart';
import '../widgets/glass.dart';
import '../widgets/price_text.dart';
import '../widgets/section_header.dart';
import '../widgets/unit_status_chip.dart';
import 'customer_home_dashboard.dart';
import 'home_cubit.dart';

/// Bottom clearance for the shell's floating assistant FAB.
const double _fabClearance = 96;

/// Navy depth gradient stops shared by the hero and CTA band.
const Color _webNavyLight = Color(0xFF24426A);
const Color _webNavyMid = Color(0xFF14273F);
const Color _webNavyDeep = Color(0xFF0B1726);

/// الرئيسية tab. Guest → marketing home (header + image hero + category pills
/// + featured projects + units grid + CTA). Authenticated customer → ownership
/// dashboard (CustomerHomeDashboard, which supplies its own header).
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state;
    final isCustomer = session.isAuthenticated && session.role.isCustomerSide;
    final comparing = context.watch<CompareCubit>().state.isNotEmpty;

    return RefreshIndicator(
      onRefresh: () async {
        final home = context.read<HomeCubit>();
        final property = isCustomer ? context.read<MyPropertyCubit>() : null;
        final installments =
            isCustomer ? context.read<InstallmentsCubit>() : null;
        final maintenance =
            isCustomer ? context.read<MaintenanceRequestsCubit>() : null;
        await home.load();
        property?.load();
        installments?.load();
        maintenance?.load();
      },
      child: ListView(
        padding: EdgeInsets.only(
          bottom: (context.isApplePlatform
                  ? MediaQuery.of(context).padding.bottom + 32
                  : AppSpacing.lg) +
              (comparing
                  ? (context.isApplePlatform ? 112 : 84)
                  : _fabClearance),
        ),
        children: [
          if (isCustomer)
            CustomerHomeDashboard(
              name: session.sessionOrNull?.displayName ??
                  session.sessionOrNull?.email,
            )
          else ...[
            // In-body header — the shell AppBar is suppressed for Home.
            const _GuestHomeHeader(),
            const SizedBox(height: AppSpacing.sm),
            // Image hero with search bar (uses first featured project cover
            // as background once it loads; falls back to navy gradient).
            BlocBuilder<HomeCubit, HomeState>(
              builder: (context, state) {
                final heroUrl = state.data?.firstOrNull?.coverImage;
                return _HeroImageBanner(imageUrl: heroUrl);
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            // Property-type filter pills.
            const _CategoryPillsRow(),
            const SizedBox(height: AppSpacing.xl),
            // Featured projects section header.
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: SectionHeader(
                title: l10n.homeFeaturedProjects,
                onViewAll: () => context.go('/projects'),
              ),
            ),
            const _FeaturedProjects(),
            const SizedBox(height: AppSpacing.xl),
            // Featured units 2-column grid.
            const _HomeUnitsGrid(),
            const SizedBox(height: AppSpacing.lg),
            const _HomeCtaBand(),
          ],
        ],
      ),
    );
  }
}

// ─── Guest Home Header ────────────────────────────────────────────────────────

/// Custom in-body header for the guest Home tab: bell button (end/left in RTL),
/// logo + brand name (centre), greeting + subtitle (start/right in RTL).
class _GuestHomeHeader extends StatelessWidget {
  const _GuestHomeHeader();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    // Set status-bar icon contrast: dark glyphs on the light canvas.
    final isDark = theme.brightness == Brightness.dark;
    final overlay =
        (isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark)
            .copyWith(statusBarColor: Colors.transparent);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: overlay,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          topInset + AppSpacing.sm,
          AppSpacing.lg,
          0,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // START (right in RTL): greeting column.
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.star_rounded,
                        size: 12,
                        color: colors.brandGold,
                      ),
                      const SizedBox(width: AppSpacing.xxs),
                      Text(
                        l10n.homeGuestGreeting,
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: colors.brandGold,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    l10n.homeGuestSubtitle,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: colors.inkMuted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            // CENTRE: brand logo + app name.
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const BrandMark(size: 30),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  l10n.customerAppTitle,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
            // END (left in RTL): notification bell.
            Expanded(
              child: Align(
                alignment: AlignmentDirectional.centerEnd,
                child: _GuestBellButton(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GuestBellButton extends StatelessWidget {
  const _GuestBellButton();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: colors.surface,
        shape: BoxShape.circle,
        border: Border.all(color: colors.hairline),
        boxShadow: colors.shadowSoft,
      ),
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => GoRouter.of(context).push('/login'),
          child: Icon(
            AppIcons.notification,
            size: 20,
            color: colors.inkStrong,
          ),
        ),
      ),
    );
  }
}

// ─── Hero Image Banner ────────────────────────────────────────────────────────

/// Full-width rounded hero: a real-estate cover image (from the first featured
/// project) with a bottom gradient for text legibility, the hero title + gold
/// subtitle + decorative line, and a compact search + filter row at the bottom.
class _HeroImageBanner extends StatefulWidget {
  const _HeroImageBanner({this.imageUrl});

  final String? imageUrl;

  @override
  State<_HeroImageBanner> createState() => _HeroImageBannerState();
}

class _HeroImageBannerState extends State<_HeroImageBanner> {
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
    context.go(
      query.isEmpty
          ? '/projects'
          : '/projects?q=${Uri.encodeQueryComponent(query)}',
    );
  }

  void _openFilters() => context.go('/projects');

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: SizedBox(
          height: 252,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Background: property image or navy gradient fallback.
              if (widget.imageUrl != null && widget.imageUrl!.isNotEmpty)
                AppNetworkImage(url: widget.imageUrl)
              else
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment(0.64, -1.0),
                      radius: 1.5,
                      colors: [_webNavyLight, _webNavyMid, _webNavyDeep],
                      stops: [0.0, 0.58, 1.0],
                    ),
                  ),
                ),
              // Gradient overlay — heavy at the bottom for text.
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Color(0x00000000),
                        Color(0x33000000),
                        Color(0xBF000000),
                        Color(0xE5000000),
                      ],
                      stops: [0.0, 0.30, 0.65, 1.0],
                    ),
                  ),
                ),
              ),
              // Faint dot texture (matches the CTA band aesthetic).
              const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
              // Content: pinned to the bottom of the card.
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    0,
                    AppSpacing.lg,
                    AppSpacing.lg,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        l10n.homeHeroTitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.headlineMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.15,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        l10n.homeHeroSubtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppPalette.gold300,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      // Decorative gold accent line.
                      const _HeroGoldDivider(),
                      const SizedBox(height: AppSpacing.sm),
                      // Search pill (expanded) + filter button.
                      Row(
                        children: [
                          Expanded(
                            child: _HeroSearchPill(
                              controller: _search,
                              onSearch: _runSearch,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          _FilterPill(onTap: _openFilters),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.03, end: 0);
  }
}

class _HeroGoldDivider extends StatelessWidget {
  const _HeroGoldDivider();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 2,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AppPalette.gold400.withValues(alpha: 0.0),
                AppPalette.gold400,
              ],
            ),
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(width: AppSpacing.xs),
        Container(
          width: 6,
          height: 6,
          decoration: const BoxDecoration(
            color: AppPalette.gold400,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: AppSpacing.xxs),
        Container(
          width: 4,
          height: 4,
          decoration: BoxDecoration(
            color: AppPalette.gold400.withValues(alpha: 0.5),
            shape: BoxShape.circle,
          ),
        ),
      ],
    );
  }
}

/// White pill search field with a leading search icon (appears at START = right
/// in RTL, matching the reference design).
class _HeroSearchPill extends StatelessWidget {
  const _HeroSearchPill({required this.controller, required this.onSearch});

  final TextEditingController controller;
  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      height: 50,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.pillAll,
        boxShadow: colors.shadowSoft,
      ),
      child: TextField(
        controller: controller,
        textInputAction: TextInputAction.search,
        onSubmitted: onSearch,
        style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkStrong),
        decoration: InputDecoration(
          isDense: true,
          contentPadding:
              const EdgeInsetsDirectional.only(end: AppSpacing.md),
          border: InputBorder.none,
          hintText: l10n.homeSearchHint,
          hintStyle:
              theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted),
          prefixIcon:
              Icon(Icons.search_rounded, size: 20, color: colors.inkMuted),
        ),
      ),
    );
  }
}

/// Glass filter button — icon only, compact square.
class _FilterPill extends StatelessWidget {
  const _FilterPill({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Material(
      color: Colors.white.withValues(alpha: 0.14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        side: BorderSide(color: Colors.white.withValues(alpha: 0.35)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Tooltip(
          message: l10n.homeFilterAction,
          child: const SizedBox(
            width: 50,
            height: 50,
            child: Icon(Icons.tune_rounded, size: 22, color: Colors.white),
          ),
        ),
      ),
    );
  }
}

// ─── Category Pills ───────────────────────────────────────────────────────────

class _CategoryPillsRow extends StatefulWidget {
  const _CategoryPillsRow();

  @override
  State<_CategoryPillsRow> createState() => _CategoryPillsRowState();
}

class _CategoryPillsRowState extends State<_CategoryPillsRow> {
  int _selected = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    final categories = <({IconData icon, String label, VoidCallback onTap})>[
      (
        icon: Icons.home_outlined,
        label: l10n.homeTypeResidential,
        onTap: () => GoRouter.of(context).go('/projects'),
      ),
      (
        icon: Icons.store_outlined,
        label: l10n.homeTypeCommercial,
        onTap: () => GoRouter.of(context).go('/projects'),
      ),
      (
        icon: Icons.business_center_outlined,
        label: l10n.homeTypeOffice,
        onTap: () => GoRouter.of(context).go('/projects'),
      ),
      (
        icon: Icons.location_city_outlined,
        label: l10n.navProjects,
        onTap: () => GoRouter.of(context).go('/projects'),
      ),
      (
        icon: Icons.grid_view_outlined,
        label: l10n.navUnits,
        onTap: () => GoRouter.of(context).go('/units'),
      ),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Row(
        children: [
          for (int i = 0; i < categories.length; i++) ...[
            if (i > 0) const SizedBox(width: AppSpacing.sm),
            _CategoryPill(
              icon: categories[i].icon,
              label: categories[i].label,
              selected: _selected == i,
              onTap: () {
                setState(() => _selected = i);
                categories[i].onTap();
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _CategoryPill extends StatelessWidget {
  const _CategoryPill({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    final bg = selected ? AppPalette.navy : colors.surface;
    final fg = selected ? Colors.white : colors.inkStrong;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: AppRadii.pillAll,
          border: Border.all(
            color: selected
                ? AppPalette.gold400.withValues(alpha: 0.30)
                : colors.hairline,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: AppPalette.gold400.withValues(alpha: 0.18),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : colors.shadowSoft,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: fg),
            const SizedBox(width: AppSpacing.xs),
            Text(
              label,
              style: theme.textTheme.labelMedium?.copyWith(
                color: fg,
                fontWeight:
                    selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Featured Projects ────────────────────────────────────────────────────────

class _FeaturedProjects extends StatelessWidget {
  const _FeaturedProjects();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<HomeCubit, HomeState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return const _FeaturedProjectsSkeleton();
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

class _FeaturedProjectsSkeleton extends StatelessWidget {
  const _FeaturedProjectsSkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final radius = BorderRadius.circular(AppRadii.xl);
    final cardWidth = MediaQuery.sizeOf(context).width * 0.88;
    return Column(
      children: [
        SizedBox(
          height: 256,
          child: AppSkeletonizer(
            enabled: true,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              itemCount: 3,
              separatorBuilder: (_, _) =>
                  const SizedBox(width: AppSpacing.md),
              itemBuilder: (_, _) => Container(
                width: cardWidth,
                decoration: BoxDecoration(
                  color: colors.surfaceSoft,
                  borderRadius: radius,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < 3; i++)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == 0 ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: i == 0
                      ? colors.brandGold.withValues(alpha: 0.4)
                      : colors.hairline,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _FeaturedProjectsCarousel extends StatefulWidget {
  const _FeaturedProjectsCarousel({required this.projects});

  final List<ProjectListItem> projects;

  @override
  State<_FeaturedProjectsCarousel> createState() =>
      _FeaturedProjectsCarouselState();
}

class _FeaturedProjectsCarouselState
    extends State<_FeaturedProjectsCarousel> {
  late final PageController _controller;
  Timer? _timer;
  int _page = 0;

  static const _interval = Duration(seconds: 5);

  @override
  void initState() {
    super.initState();
    // 0.93 viewport fraction — active card is prominent, adjacent cards
    // peek at the sides just enough to signal swipeability.
    _controller = PageController(viewportFraction: 0.93);
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
          height: 256,
          child: Listener(
            onPointerDown: (_) => _pauseAutoPlay(),
            onPointerUp: (_) => _startAutoPlay(),
            onPointerCancel: (_) => _startAutoPlay(),
            child: PageView.builder(
              controller: _controller,
              itemCount: projects.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (context, i) => Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.xs),
                child: _HomeProjectCard(
                  project: projects[i],
                  onTap: () =>
                      context.push('/projects/${projects[i].id}'),
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
                    color: i == _page
                        ? colors.brandGold
                        : colors.hairline,
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

// ─── Featured Units — 2-column grid ──────────────────────────────────────────

class _HomeUnitsGrid extends StatefulWidget {
  const _HomeUnitsGrid();

  @override
  State<_HomeUnitsGrid> createState() => _HomeUnitsGridState();
}

class _HomeUnitsGridState extends State<_HomeUnitsGrid> {
  late final Future<Result<Paginated<Unit>>> _future;

  @override
  void initState() {
    super.initState();
    _future = GetUnits(context.read<CatalogRepository>())(
      const GetUnitsParams(status: UnitStatus.available, page: 1, pageSize: 4),
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

        final display = units.take(4).toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: SectionHeader(
                title: l10n.homeFeaturedUnits,
                onViewAll: () => context.go('/units'),
              ),
            ),
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Column(
                children: [
                  for (int row = 0;
                      row < (display.length / 2).ceil();
                      row++) ...[
                    if (row > 0) const SizedBox(height: AppSpacing.sm),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (int col = 0; col < 2; col++) ...[
                          if (col > 0)
                            const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: row * 2 + col < display.length
                                ? _HomeUnitCard(
                                    unit: display[row * 2 + col],
                                    onTap: () => context.push(
                                      '/units/${display[row * 2 + col].id}',
                                    ),
                                  )
                                : const SizedBox.shrink(),
                          ),
                        ],
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Compact card for the 2-column home grid: 125px image, tight content block
/// (type + price, location, specs). Only the favourite toggle is shown on-image
/// (no compare button — keeps the grid clean).
class _HomeUnitCard extends StatelessWidget {
  const _HomeUnitCard({required this.unit, this.onTap});

  final Unit unit;
  final VoidCallback? onTap;

  static const double _imageHeight = 125;

  Color _statusColor(AppColorsExt c, UnitStatus s) => switch (s) {
        UnitStatus.available => c.success,
        UnitStatus.reserved => c.warning,
        UnitStatus.sold => c.inkMuted,
        UnitStatus.unknown => c.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;

    final projectName =
        unit.project?.name.resolve(lang).trim() ?? '';
    final city = unit.project?.city.trim() ?? '';

    return LuxeCard(
      onTap: onTap,
      radius: AppRadii.lg,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Image ────────────────────────────────────────────────────────
          SizedBox(
            height: _imageHeight,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppNetworkImage(url: unit.coverImage),
                const ImageScrim(),
                // Availability badge — start (right in RTL).
                if (unit.status != UnitStatus.unknown)
                  PositionedDirectional(
                    top: AppSpacing.xs,
                    start: AppSpacing.xs,
                    child: GlassPill(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color:
                                  _statusColor(colors, unit.status),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.xxs),
                          Text(unit.status.label(l10n)),
                        ],
                      ),
                    ),
                  ),
                // Heart — end (left in RTL).
                PositionedDirectional(
                  top: AppSpacing.xs,
                  end: AppSpacing.xs,
                  child: GlassCircle(
                    child: FavoriteToggleButton(
                      isProject: false,
                      id: unit.id,
                      dense: true,
                    ),
                  ),
                ),
                // Project name overlay.
                if (projectName.isNotEmpty)
                  PositionedDirectional(
                    bottom: AppSpacing.xs,
                    start: AppSpacing.xs,
                    end: AppSpacing.xs,
                    child: Row(
                      children: [
                        const Icon(
                          Icons.apartment_rounded,
                          size: 11,
                          color: AppPalette.gold300,
                        ),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            projectName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                theme.textTheme.labelSmall?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          // ── Content ──────────────────────────────────────────────────────
          Container(
            width: double.infinity,
            color: Color.lerp(
                colors.surface, colors.surfaceSoft, 0.5),
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Text(
                        unit.type,
                        style:
                            theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: colors.inkStrong,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    PriceText(
                      unit.price,
                      style: theme.textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                if (city.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Icon(
                        Icons.location_on_rounded,
                        size: 11,
                        color: colors.brandGold,
                      ),
                      const SizedBox(width: 2),
                      Expanded(
                        child: Text(
                          city,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: colors.inkMuted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: 2,
                  children: [
                    if (unit.bedrooms > 0)
                      _MiniSpec(
                        icon: Icons.bed_rounded,
                        value: '${unit.bedrooms}',
                      ),
                    if (unit.bathrooms > 0)
                      _MiniSpec(
                        icon: Icons.bathtub_rounded,
                        value: '${unit.bathrooms}',
                      ),
                    if (unit.area > 0)
                      _MiniSpec(
                        icon: Icons.square_foot_rounded,
                        value: l10n.areaValue('${unit.area}'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniSpec extends StatelessWidget {
  const _MiniSpec({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: colors.brandGold),
        const SizedBox(width: 2),
        Text(
          value,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: colors.inkStrong,
                fontSize: 11,
              ),
        ),
      ],
    );
  }
}

// ─── CTA Band (horizontal, compact) ──────────────────────────────────────────

class _HomeCtaBand extends StatelessWidget {
  const _HomeCtaBand();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Padding(
      padding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.xl),
            boxShadow: colors.shadowLift,
          ),
          child: Stack(
            children: [
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment(0.64, -1.0),
                      radius: 1.5,
                      colors: [_webNavyLight, _webNavyMid, _webNavyDeep],
                      stops: [0.0, 0.58, 1.0],
                    ),
                  ),
                ),
              ),
              const Positioned.fill(
                  child: IgnorePointer(child: _DotTexture())),
              // Gold hairline accent at the top.
              Positioned(
                top: 0,
                left: AppSpacing.xxl,
                right: AppSpacing.xxl,
                child: Container(
                  height: 1,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppPalette.gold400.withValues(alpha: 0.0),
                        AppPalette.gold400.withValues(alpha: 0.55),
                        AppPalette.gold400.withValues(alpha: 0.0),
                      ],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.lg,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // START (right in RTL): text content.
                    Expanded(
                      child: Column(
                        crossAxisAlignment:
                            CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            l10n.homeCtaTitle,
                            style:
                                theme.textTheme.titleMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              height: 1.2,
                            ),
                            maxLines: 2,
                          ),
                          const SizedBox(height: AppSpacing.xxs),
                          Text(
                            l10n.homeCtaSubtitle,
                            style:
                                theme.textTheme.bodySmall?.copyWith(
                              color: Colors.white
                                  .withValues(alpha: 0.72),
                              height: 1.4,
                            ),
                            maxLines: 2,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    // END (left in RTL): gold action button.
                    AppButton(
                      label: l10n.homeCtaAction,
                      icon: Icons.headset_mic_rounded,
                      variant: AppButtonVariant.gold,
                      size: AppButtonSize.small,
                      onPressed: () => context.push('/chat'),
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

// ─── Dot texture ─────────────────────────────────────────────────────────────

class _DotTexture extends StatelessWidget {
  const _DotTexture();

  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.05);
    const step = 22.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter oldDelegate) => false;
}

// ─── Home project card ────────────────────────────────────────────────────────

/// Full-image overlay card for the featured-projects carousel. Distinct from
/// the /projects list ProjectCard — image-only with badge + location + title +
/// units pill composed on top.
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
              // "مميز" badge — start (right in RTL).
              if (project.featured)
                PositionedDirectional(
                  top: AppSpacing.sm,
                  start: AppSpacing.sm,
                  child: GlassPill(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.star_rounded,
                          color: AppPalette.gold300,
                          size: 13,
                        ),
                        const SizedBox(width: AppSpacing.xxs),
                        Text(l10n.featuredBadge),
                      ],
                    ),
                  ),
                ),
              // Heart — end (left in RTL).
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
              // Location + title + units row — bottom overlay.
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
                              style: theme.textTheme.labelMedium
                                  ?.copyWith(
                                color: Colors.white
                                    .withValues(alpha: 0.9),
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
                        // Units pill — start (right in RTL).
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
                        // Navigation arrow — end (left in RTL).
                        GlassCircle(
                          child: SizedBox(
                            width: 34,
                            height: 34,
                            child: Icon(
                              rtl
                                  ? Icons.chevron_left_rounded
                                  : Icons.chevron_right_rounded,
                              color: Colors.white,
                              size: 20,
                            ),
                          ),
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
