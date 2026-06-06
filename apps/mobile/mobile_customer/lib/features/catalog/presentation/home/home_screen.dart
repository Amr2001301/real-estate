import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/material.dart';
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
import '../widgets/section_header.dart';
import '../widgets/unit_card.dart';
import 'customer_home_dashboard.dart';
import 'home_cubit.dart';

/// Bottom clearance reserved on the Home tab for the shell's floating assistant
/// FAB (46px + lift), so the last discovery card / carousel dots never end up
/// hidden behind it. Applied only when the compare dock isn't taking over.
const double _fabClearance = 72;

/// The الرئيسية tab. For a signed-in customer it is an ownership-first dashboard
/// (greeting + owned property + next installment + live counts + quick actions
/// + recent activity) above the featured projects/units; for guests it stays
/// the marketing hero + featured + CTAs.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state;
    final isCustomer = session.isAuthenticated && session.role.isCustomerSide;
    // Reserve extra space when the shell's sticky compare dock is showing, so
    // the last card/CTA is never hidden behind it.
    final comparing = context.watch<CompareCubit>().state.isNotEmpty;

    // Body-only: the persistent CustomerShellScaffold supplies the app bar
    // (title, notification bell, language/theme toggles, avatar) + bottom nav.
    return RefreshIndicator(
      onRefresh: () async {
        // Capture cubits before the await so no BuildContext is used across the
        // async gap. Pull-to-refresh also refreshes the owner dashboard cubits
        // that the /home route provides for a signed-in customer.
        final home = context.read<HomeCubit>();
        final property = isCustomer ? context.read<MyPropertyCubit>() : null;
        final installments = isCustomer
            ? context.read<InstallmentsCubit>()
            : null;
        final maintenance = isCustomer
            ? context.read<MaintenanceRequestsCubit>()
            : null;
        await home.load();
        property?.load();
        installments?.load();
        maintenance?.load();
      },
      child: ListView(
        // Single source of bottom clearance (no extra trailing spacer below).
        // iOS: the floating dock overlays the body (extendBody) and floats
        // ~40px above the safe-area inset; clear it plus a small premium gap so
        // the CTA sits just above the dock (~16–24px breathing room) — never a
        // large blank, never hidden behind the dock. Android: the in-slot bar
        // handles its own safe area, so just a small comfortable gap above it.
        //
        // When NOT comparing, the shell floats the assistant FAB over the Home
        // tab's bottom-start corner; reserve [_fabClearance] so the last
        // discovery card + carousel dots always settle ABOVE the FAB rather than
        // hidden behind it. While comparing, the sticky compare dock replaces
        // the FAB, so its larger offset applies instead.
        padding: EdgeInsets.only(
          bottom:
              (context.isApplePlatform
                  ? MediaQuery.of(context).padding.bottom + 32
                  : AppSpacing.lg) +
              (comparing
                  ? (context.isApplePlatform ? 112 : 84)
                  : _fabClearance),
        ),
        children: [
          if (isCustomer) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                0,
              ),
              child: CustomerHomeDashboard(
                name:
                    session.sessionOrNull?.displayName ??
                    session.sessionOrNull?.email,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
          ] else ...[
            // One integrated hero+search module (navy hero with an embedded
            // warm search dock), inspired by the website hero search panel.
            const _HeroSearchDock(),
            const SizedBox(height: AppSpacing.xl),
          ],
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            child: SectionHeader(
              title: l10n.homeFeaturedProjects,
              onViewAll: () => context.go('/projects'),
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
        ],
      ),
    );
  }
}

// ── Website-matched navy depth gradient stops (Hero + CTA) ──────────────────
// Mirrors the web `radial-gradient(... #24426A → #14273F → #0B1726)` so the
// mobile hero/CTA read as the same brand surface as the marketing site.
const Color _webNavyLight = Color(0xFF24426A);
const Color _webNavyMid = Color(0xFF14273F);
const Color _webNavyDeep = Color(0xFF0B1726);

/// Compact luxury guest hero — a short navy intro card (website depth gradient +
/// gold glow) with a one-row search dock: a search pill (gold circular submit)
/// plus a compact "التصفية" pill that opens the [_HomeFilterSheet]. Property-type
/// selection lives in that sheet, NOT as a heavy chip row — so the hero stays
/// short and the projects section appears sooner. Search → /projects?q=… (the
/// only text-searchable catalog route on mobile).
class _HeroSearchDock extends StatefulWidget {
  const _HeroSearchDock();

  @override
  State<_HeroSearchDock> createState() => _HeroSearchDockState();
}

class _HeroSearchDockState extends State<_HeroSearchDock> {
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

  /// Free-text search targets the المشاريع tab (the only catalog route that
  /// reads a `?q=` query param). Uses `context.go` so the Projects tab becomes
  /// active (single app bar, no back arrow) instead of pushing it inside the
  /// Home stack.
  void _runSearch(String raw) {
    final query = raw.trim();
    context.go(
      query.isEmpty
          ? '/projects'
          : '/projects?q=${Uri.encodeQueryComponent(query)}',
    );
  }

  /// The hero filter shortcut switches to the المشاريع tab, where the real
  /// (backend-supported) city / featured / sort filters live. There is no
  /// backend property-type filter, so Home does not fake one with a text query.
  void _openFilters() => context.go('/projects');

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

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
            // Base navy depth gradient — same direction/depth as the lower
            // CtaBand so the two navy surfaces read as one design system.
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
            // Faint dotted texture — the same subtle pattern as the CtaBand, so
            // the navy never reads as a flat block.
            const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
            // Gold ambient glow behind the start-side content (RTL-aware).
            const Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: AlignmentDirectional(-0.9, 0.9),
                      radius: 0.9,
                      colors: [Color(0x1FC8A24B), Color(0x00C8A24B)],
                      stops: [0.0, 0.7],
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.md,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const BrandMark(size: 26),
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
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.homeHeroTitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.homeHeroSubtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.78),
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  // Compact one-row search dock.
                  Row(
                    children: [
                      Expanded(
                        child: _HeroSearchBar(
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
          ],
        ),
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.03, end: 0);
  }
}

/// A compact white search pill with a trailing gold circular submit button,
/// designed to float on the navy hero. Submitting (keyboard or gold button)
/// runs the search.
class _HeroSearchBar extends StatelessWidget {
  const _HeroSearchBar({required this.controller, required this.onSearch});

  final TextEditingController controller;
  final ValueChanged<String> onSearch;

  static const double _height = 50;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      height: _height,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.pillAll,
        boxShadow: colors.shadowSoft,
      ),
      padding: const EdgeInsetsDirectional.only(
        start: AppSpacing.md,
        end: AppSpacing.xxs,
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              textInputAction: TextInputAction.search,
              onSubmitted: onSearch,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: colors.inkStrong,
              ),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: l10n.homeSearchHint,
                hintStyle: theme.textTheme.bodyMedium?.copyWith(
                  color: colors.inkMuted,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.xxs),
          // Gold circular submit.
          Material(
            color: colors.brandGold,
            shape: const CircleBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => onSearch(controller.text),
              child: SizedBox(
                width: 38,
                height: 38,
                child: Icon(
                  Icons.search_rounded,
                  size: 20,
                  color: colors.brandNavy,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A compact glass filter button (icon-only, white-translucent on navy) that
/// opens the Home filter sheet. Deliberately small so the search pill keeps
/// most of the row width.
class _FilterPill extends StatelessWidget {
  const _FilterPill({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Material(
      color: Colors.white.withValues(alpha: 0.12),
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

/// Lower CTA band — matches the website `CtaBand`: a contained navy card with
/// the website depth gradient (120% 150% at 82% 0%), a faint dotted texture so
/// it never reads as a flat block, gold ambient glow + top gold hairline, an
/// eyebrow chip, and two real buttons (gold primary + white-outline secondary).
class _HomeCtaBand extends StatelessWidget {
  const _HomeCtaBand();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.xl),
            boxShadow: colors.shadowLift,
          ),
          child: Stack(
            children: [
              // Website CtaBand depth gradient.
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
              // Faint dotted texture (so the navy never reads as a flat block).
              const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
              // Gold ambient glow in the end-corner.
              const Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: AlignmentDirectional(-0.9, 0.9),
                        radius: 0.9,
                        colors: [Color(0x1FC8A24B), Color(0x00C8A24B)],
                        stops: [0.0, 0.7],
                      ),
                    ),
                  ),
                ),
              ),
              // Top gold hairline accent.
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
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm,
                        vertical: AppSpacing.xxs,
                      ),
                      decoration: BoxDecoration(
                        color: AppPalette.gold400.withValues(alpha: 0.15),
                        borderRadius: AppRadii.pillAll,
                        border: Border.all(
                          color: AppPalette.gold400.withValues(alpha: 0.25),
                        ),
                      ),
                      child: Text(
                        l10n.homeCtaEyebrow,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: AppPalette.gold200,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      l10n.homeCtaTitle,
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.homeCtaSubtitle,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.75),
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    // Centered hug-content buttons (mirrors the website mobile
                    // CtaBand): a gold primary above a clearly-bordered ghost
                    // secondary. Hugging content keeps the gold pill from
                    // reading as a bulky full-width block, and full labels never
                    // truncate. RTL-safe.
                    Row(
                      children: [
                        Expanded(
                          child: AppButton(
                            label: l10n.homeCtaAction,
                            icon: Icons.headset_mic_rounded,
                            variant: AppButtonVariant.gold,
                            size: AppButtonSize.medium,
                            onPressed: () => context.push('/chat'),
                          ),
                        ),
                        // const SizedBox(width: AppSpacing.sm),
                        // Expanded(
                        //   child: _GhostButton(
                        //     label: l10n.homeCtaSecondary,
                        //     // icon: Icons.arrow_back_rounded,
                        //     onPressed: () => context.push('/units'),
                        //   ),
                        // ),
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

/// A faint dotted overlay echoing the website CtaBand texture.
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
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.05);
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

/// Home-only loading skeleton for the featured-projects slider. Mirrors the
/// live carousel exactly: image-only rounded cards (NO white content body), the
/// same 260px height and side-peek feel, plus a dots placeholder — so the
/// loading state reads as the real Home slider, not the /projects list card.
class _FeaturedProjectsSkeleton extends StatelessWidget {
  const _FeaturedProjectsSkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final radius = BorderRadius.circular(AppRadii.xl);
    final cardWidth = MediaQuery.sizeOf(context).width * 0.8;
    return Column(
      children: [
        SizedBox(
          height: 260,
          child: AppSkeletonizer(
            enabled: true,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              itemCount: 3,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
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
          height: 225,
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
                onViewAll: () => context.go('/units'),
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
