import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../../home_summary/presentation/home_summary_cubit.dart';
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
        if (isCustomer) {
          await context.read<HomeSummaryCubit>().load();
        } else {
          await context.read<HomeCubit>().load();
        }
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.only(
          // Nav bar reserves its own space (extendBody: false), so no safe-area
          // math needed here. Just clear the compare-bar overlay when active,
          // or leave comfortable breathing room at rest.
          bottom: comparing
              ? (context.isApplePlatform ? 112 : 84)
              : AppSpacing.xl,
        ),
        children: [
          if (isCustomer)
            CustomerHomeDashboard(
              name:
                  session.sessionOrNull?.displayName ??
                  session.sessionOrNull?.email,
            )
          else ...[
            // Full-bleed immersive hero — contains the brand header + bell
            // overlay AND the headline + search content. Sets light status-bar
            // icons; the section header below restores dark icons on scroll.
            BlocBuilder<HomeCubit, HomeState>(
              builder: (context, state) {
                final heroUrl = state.data?.firstOrNull?.coverImage;
                return _HeroSection(imageUrl: heroUrl);
              },
            ),
            const SizedBox(height: AppSpacing.lg),
            // Restores dark status-bar glyphs as the canvas enters the viewport.
            AnnotatedRegion<SystemUiOverlayStyle>(
              value: SystemUiOverlayStyle.dark.copyWith(
                statusBarColor: Colors.transparent,
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: SectionHeader(
                  title: l10n.homeFeaturedProjects,
                  onViewAll: () => context.go('/projects'),
                ),
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

// ─── Hero Section (full-bleed, embedded header) ──────────────────────────────

/// Immersive full-bleed hero. The property cover image extends flush to the
/// screen edges — no horizontal padding, no rounded top corners. Sharp top
/// corners (flush to the device frame) + rounded bottom corners (AppRadii.xxl)
/// create the premium "cinematic frame" look.
///
/// The brand header (logo + bell) is composited on top of the image with a
/// white/glass treatment. The greeting + headline + search sit in the lower
/// content zone over the bottom gradient. An [AnnotatedRegion] inside sets
/// white status-bar icons; the category row below restores dark icons on scroll.
class _HeroSection extends StatefulWidget {
  const _HeroSection({this.imageUrl});

  final String? imageUrl;

  @override
  State<_HeroSection> createState() => _HeroSectionState();
}

class _HeroSectionState extends State<_HeroSection> {
  late final TextEditingController _search;
  String? _filterType;

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

  Future<void> _openFilters() async {
    final result = await showModalBottomSheet<String?>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TypeFilterSheet(initial: _filterType),
    );
    if (!mounted || result == null) return;
    final newFilter = result.isEmpty ? null : result;
    setState(() => _filterType = newFilter);
    if (mounted) {
      context.go(
        newFilter == null
            ? '/projects'
            : '/projects?type=${Uri.encodeQueryComponent(newFilter)}',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(AppRadii.xxl),
          bottomRight: Radius.circular(AppRadii.xxl),
        ),
        child: SizedBox(
          height: topInset + 360,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // ── Background ──────────────────────────────────────────────
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
              // Top vignette: keeps the brand/bell readable over bright sky.
              const Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: 160,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0xA0000000), Color(0x00000000)],
                    ),
                  ),
                ),
              ),
              // Bottom gradient: deep for title/search legibility.
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Color(0x1A000000),
                        Color(0x00000000),
                        Color(0xCC000000),
                        Color(0xF2000000),
                      ],
                      stops: [0.0, 0.30, 0.64, 1.0],
                    ),
                  ),
                ),
              ),
              // Subtle dot texture (depth cue on solid-gradient fallback).
              const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
              // ── Brand + bell row ─────────────────────────────────────────
              PositionedDirectional(
                top: topInset + AppSpacing.xs,
                start: AppSpacing.lg,
                end: AppSpacing.lg,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // START (right in RTL): logo mark + brand name.
                    const BrandMark(size: 30),
                    const SizedBox(width: AppSpacing.xs),
                    Text(
                      l10n.customerAppTitle,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.4,
                        shadows: const [
                          Shadow(color: Color(0x66000000), blurRadius: 10),
                        ],
                      ),
                    ),
                    const Spacer(),
                    // END (left in RTL): frosted glass bell.
                    const _HeroBellButton(),
                  ],
                ),
              ),
              // ── Greeting + headline + search ─────────────────────────────
              PositionedDirectional(
                bottom: 0,
                start: 0,
                end: 0,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    0,
                    AppSpacing.lg,
                    AppSpacing.xl,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Personal greeting (warm intro before the main CTA).
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.star_rounded,
                            size: 12,
                            color: AppPalette.gold300,
                          ),
                          const SizedBox(width: AppSpacing.xxs),
                          Text(
                            l10n.homeGuestGreeting,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: AppPalette.gold300,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      // Hero headline — displaySmall for maximum impact.
                      Text(
                        l10n.homeHeroTitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.displaySmall?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          height: 1.1,
                          letterSpacing: -0.5,
                          shadows: const [
                            Shadow(color: Color(0x44000000), blurRadius: 16),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
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
                      const _HeroGoldDivider(),
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        children: [
                          Expanded(
                            child: _HeroSearchPill(
                              controller: _search,
                              onSearch: _runSearch,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          _FilterPill(
                            onTap: _openFilters,
                            hasFilter: _filterType != null,
                          ),
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
    ).animate().fadeIn(duration: 600.ms);
  }
}

/// Frosted glass bell button composited on the dark hero image.
/// Reuses [GlassCircle]'s backdrop-blur treatment — the same surface that
/// powers favourite/compare overlays on project cards.
class _HeroBellButton extends StatelessWidget {
  const _HeroBellButton();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GlassCircle(
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => GoRouter.of(context).push('/login'),
          child: SizedBox(
            width: 42,
            height: 42,
            child: Icon(
              AppIcons.notification,
              size: 20,
              color: colors.inkStrong,
            ),
          ),
        ),
      ),
    );
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
          contentPadding: const EdgeInsetsDirectional.only(end: AppSpacing.md),
          border: InputBorder.none,
          hintText: l10n.homeSearchHint,
          hintStyle: theme.textTheme.bodyMedium?.copyWith(
            color: colors.inkMuted,
          ),
          prefixIcon: Icon(
            Icons.search_rounded,
            size: 20,
            color: colors.inkMuted,
          ),
        ),
      ),
    );
  }
}

/// Glass filter button — icon only, compact square.
/// Shows a gold dot badge when [hasFilter] is true (a type is active).
class _FilterPill extends StatelessWidget {
  const _FilterPill({required this.onTap, this.hasFilter = false});

  final VoidCallback onTap;
  final bool hasFilter;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Material(
      color: hasFilter
          ? AppPalette.gold400.withValues(alpha: 0.22)
          : Colors.white.withValues(alpha: 0.14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        side: BorderSide(
          color: hasFilter
              ? AppPalette.gold400.withValues(alpha: 0.65)
              : Colors.white.withValues(alpha: 0.35),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Tooltip(
          message: l10n.homeFilterAction,
          child: SizedBox(
            width: 50,
            height: 50,
            child: Stack(
              alignment: Alignment.center,
              children: [
                const Icon(Icons.tune_rounded, size: 22, color: Colors.white),
                if (hasFilter)
                  PositionedDirectional(
                    top: 9,
                    end: 9,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: AppPalette.gold400,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.6),
                          width: 1,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Property Type Filter Sheet ───────────────────────────────────────────────

class _TypeFilterSheet extends StatefulWidget {
  const _TypeFilterSheet({this.initial});

  final String? initial;

  @override
  State<_TypeFilterSheet> createState() => _TypeFilterSheetState();
}

class _TypeFilterSheetState extends State<_TypeFilterSheet> {
  String? _selected;

  @override
  void initState() {
    super.initState();
    _selected = widget.initial;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final colors = context.appColors;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    final options = [
      (
        key: 'residential',
        label: l10n.homeTypeResidential,
        icon: Icons.home_outlined,
      ),
      (
        key: 'commercial',
        label: l10n.homeTypeCommercial,
        icon: Icons.store_outlined,
      ),
      (
        key: 'office',
        label: l10n.homeTypeOffice,
        icon: Icons.business_center_outlined,
      ),
    ];

    return Container(
      margin: const EdgeInsets.only(top: 64),
      padding: EdgeInsets.only(bottom: bottomInset),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(AppRadii.xxl),
          topRight: Radius.circular(AppRadii.xxl),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drag handle.
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                decoration: BoxDecoration(
                  color: colors.hairline,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                AppSpacing.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    l10n.homeFilterTypeLabel,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    l10n.homeFilterHelper,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colors.inkMuted,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  for (final opt in options) ...[
                    _TypeOption(
                      icon: opt.icon,
                      label: opt.label,
                      selected: _selected == opt.key,
                      onTap: () => setState(
                        () => _selected = _selected == opt.key ? null : opt.key,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                  ],
                  const SizedBox(height: AppSpacing.sm),
                  AppButton(
                    label: l10n.homeFilterViewResults,
                    variant: AppButtonVariant.gold,
                    onPressed: () => Navigator.pop(context, _selected ?? ''),
                  ),
                  if (_selected != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Center(
                      child: TextButton(
                        onPressed: () => Navigator.pop(context, ''),
                        child: Text(
                          l10n.homeFilterClearSelection,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: colors.inkMuted,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TypeOption extends StatelessWidget {
  const _TypeOption({
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

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: selected
              ? AppPalette.navy.withValues(alpha: 0.06)
              : colors.surfaceSoft,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(
            color: selected
                ? AppPalette.gold400.withValues(alpha: 0.55)
                : colors.hairline,
            width: selected ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: selected
                    ? const LinearGradient(
                        colors: [AppPalette.navy700, AppPalette.navy],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                color: selected ? null : colors.surfaceSoft,
                borderRadius: BorderRadius.circular(AppRadii.sm),
                border: selected
                    ? Border.all(
                        color: AppPalette.gold400.withValues(alpha: 0.3),
                      )
                    : null,
              ),
              child: Icon(
                icon,
                size: 20,
                color: selected ? AppPalette.gold300 : colors.inkMuted,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                label,
                style: theme.textTheme.titleSmall?.copyWith(
                  color: selected ? AppPalette.navy : colors.inkStrong,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
            if (selected)
              const Icon(
                Icons.check_circle_rounded,
                color: AppPalette.gold400,
                size: 20,
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
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Column(
                children: [
                  for (
                    int row = 0;
                    row < (display.length / 2).ceil();
                    row++
                  ) ...[
                    if (row > 0) const SizedBox(height: AppSpacing.sm),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (int col = 0; col < 2; col++) ...[
                          if (col > 0) const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: row * 2 + col < display.length
                                ? _HomeUnitCard(
                                        unit: display[row * 2 + col],
                                        onTap: () => context.push(
                                          '/units/${display[row * 2 + col].id}',
                                        ),
                                      )
                                      .animate(
                                        delay: Duration(
                                          milliseconds: 80 * (row * 2 + col),
                                        ),
                                      )
                                      .fadeIn(duration: 360.ms)
                                      .slideY(
                                        begin: 0.07,
                                        end: 0,
                                        duration: 360.ms,
                                        curve: Curves.easeOut,
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

    final projectName = unit.project?.name.resolve(lang).trim() ?? '';
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
                              color: _statusColor(colors, unit.status),
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
                            style: theme.textTheme.labelSmall?.copyWith(
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
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Gold start-edge accent (right in RTL).
                Container(
                  width: 3,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        AppPalette.gold400,
                        AppPalette.gold400.withValues(alpha: 0.30),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: Container(
                    color: colors.surface,
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
                                style: theme.textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: colors.inkStrong,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            PriceText(
                              unit.price,
                              style: theme.textTheme.labelLarge?.copyWith(
                                fontWeight: FontWeight.w800,
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
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: colors.inkMuted,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: AppSpacing.xs),
                        Wrap(
                          spacing: AppSpacing.xs,
                          runSpacing: AppSpacing.xxs,
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.xs),
        border: Border.all(color: colors.hairline, width: 0.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: colors.brandGold),
          const SizedBox(width: 3),
          Text(
            value,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: colors.inkStrong,
              fontSize: 11,
            ),
          ),
        ],
      ),
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
              const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
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
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            l10n.homeCtaTitle,
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              height: 1.2,
                            ),
                            maxLines: 2,
                          ),
                          const SizedBox(height: AppSpacing.xxs),
                          Text(
                            l10n.homeCtaSubtitle,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: Colors.white.withValues(alpha: 0.72),
                              height: 1.4,
                            ),
                            maxLines: 2,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    // END (left in RTL): gold action button with glow.
                    DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(AppRadii.lg),
                        boxShadow: [
                          BoxShadow(
                            color: AppPalette.gold400.withValues(alpha: 0.45),
                            blurRadius: 20,
                            spreadRadius: 0,
                          ),
                        ],
                      ),
                      child: AppButton(
                        label: l10n.homeCtaAction,
                        icon: Icons.headset_mic_rounded,
                        variant: AppButtonVariant.gold,
                        size: AppButtonSize.small,
                        onPressed: () => context.push('/chat'),
                      ),
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
                        // Units pill — start (right in RTL).
                        GlassPill(
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.apartment_rounded,
                                color: AppPalette.gold300,
                                size: 13,
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
                              !rtl
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
