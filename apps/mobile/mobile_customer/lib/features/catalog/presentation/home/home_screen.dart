import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../content/presentation/content_widgets.dart';
import '../../../favorites/presentation/widgets/favorite_toggle_button.dart';
import '../../../home_summary/presentation/home_summary_cubit.dart';
import '../../../notifications/presentation/widgets/customer_notification_button.dart';
import '../../domain/entities/catalog_enums.dart';
import '../../domain/entities/project.dart';
import '../../domain/entities/unit.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../domain/usecases/get_units.dart';
import '../compare/compare_cubit.dart';
import '../widgets/glass.dart';
import '../widgets/project_card.dart';
import '../widgets/unit_card.dart';
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
    final bottomPad = comparing
        ? (context.isApplePlatform ? 112.0 : 84.0)
        : AppSpacing.xl;

    final sessionListener = BlocListener<SessionCubit, SessionState>(
      listenWhen: (prev, curr) {
        final wasCustomer = prev.isAuthenticated && prev.role.isCustomerSide;
        final nowCustomer = curr.isAuthenticated && curr.role.isCustomerSide;
        return !wasCustomer && nowCustomer;
      },
      listener: (ctx, _) => ctx.read<HomeSummaryCubit>().load(),
      child: const SizedBox.shrink(),
    );

    if (isCustomer) {
      // ── Authenticated customer: collapsing sliver header ─────────────────
      return AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light.copyWith(
          statusBarColor: Colors.transparent,
        ),
        child: Stack(
          children: [
            sessionListener,
            BlocBuilder<HomeSummaryCubit, HomeSummaryState>(
              builder: (context, state) {
                final displayName =
                    (state.data?.profile.displayName.isNotEmpty == true)
                        ? state.data!.profile.displayName
                        : (session.sessionOrNull?.displayName ??
                            session.sessionOrNull?.email);
                final hasProperty = state.data?.profile.isOwner ?? false;
                final topPad = MediaQuery.paddingOf(context).top;

                return RefreshIndicator(
                  onRefresh: () => context.read<HomeSummaryCubit>().load(),
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      SliverPersistentHeader(
                        pinned: true,
                        delegate: _CustomerHeaderDelegate(
                          topPad: topPad,
                          name: displayName,
                          hasProperty: hasProperty,
                          l10n: l10n,
                        ),
                      ),
                      SliverPadding(
                        padding: EdgeInsets.only(bottom: bottomPad),
                        sliver: SliverToBoxAdapter(
                          child: CustomerHomeDashboard(
                            name: displayName,
                            showHeader: false,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      );
    }

    // ── Guest view: unchanged ─────────────────────────────────────────────
    return BlocListener<SessionCubit, SessionState>(
      listenWhen: (prev, curr) {
        final wasCustomer = prev.isAuthenticated && prev.role.isCustomerSide;
        final nowCustomer = curr.isAuthenticated && curr.role.isCustomerSide;
        return !wasCustomer && nowCustomer;
      },
      listener: (ctx, _) => ctx.read<HomeSummaryCubit>().load(),
      child: RefreshIndicator(
        onRefresh: () => context.read<HomeCubit>().load(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.only(bottom: bottomPad),
          children: [
            BlocBuilder<HomeCubit, HomeState>(
              builder: (context, state) {
                final heroUrl = state.data?.firstOrNull?.coverImage;
                return _HeroSection(imageUrl: heroUrl);
              },
            ),
            const SizedBox(height: AppSpacing.lg),
            // CMS1 — the company's banners, as on its website.
            const HomeBanners(
              padding: EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.lg),
            ),
            HomeSection(
              icon: Icons.apartment_rounded,
              title: l10n.homeFeaturedProjects,
              action: l10n.viewAll,
              onAction: () => context.go('/projects'),
              child: const _FeaturedProjects(),
            ),
            const _HomeUnitsGrid(),
            const SizedBox(height: AppSpacing.lg),
            const _HomeCtaBand(),
          ],
        ),
      ),
    );
  }
}

// ─── Collapsing customer header ───────────────────────────────────────────────

class _CustomerRoleChip extends StatelessWidget {
  const _CustomerRoleChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppPalette.gold400, AppPalette.gold500],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.35),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Text(
        label,
        style: TextStyle(
          color: AppPalette.navy,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _CustomerDateChip extends StatelessWidget {
  const _CustomerDateChip();

  static String _fmt(DateTime d, String lang) {
    const ar = ['', 'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const en = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return lang == 'ar' ? '${d.day} ${ar[d.month]}' : '${en[d.month]} ${d.day}';
  }

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        _fmt(DateTime.now(), lang),
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.80),
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class _CustomerHeaderDelegate extends SliverPersistentHeaderDelegate {
  const _CustomerHeaderDelegate({
    required this.topPad,
    required this.name,
    required this.hasProperty,
    required this.l10n,
  });

  final double topPad;
  final String? name;
  final bool hasProperty;
  final AppLocalizations l10n;

  static const double _expandedContent = 120.0;
  static const double _collapsedContent = 64.0;

  static const _navyDeep  = Color(0xFF0B1726);
  static const _navyMid   = Color(0xFF14273F);
  static const _navyLight = Color(0xFF243F62);

  @override double get maxExtent => topPad + _expandedContent;
  @override double get minExtent => topPad + _collapsedContent;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final progress       = (shrinkOffset / (maxExtent - minExtent)).clamp(0.0, 1.0);
    final expandedAlpha  = (1.0 - progress * 2.0).clamp(0.0, 1.0);
    final collapsedAlpha = ((progress - 0.5) * 2.0).clamp(0.0, 1.0);
    final radius         = Radius.circular((1.0 - progress) * (AppRadii.xl + 4));

    return SizedBox.expand(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_navyLight, _navyMid, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(bottomLeft: radius, bottomRight: radius),
          boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 24, offset: Offset(0, 8))],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.only(bottomLeft: radius, bottomRight: radius),
          child: Stack(
            children: [
              // Dot texture
              Positioned.fill(child: CustomPaint(painter: _HeaderDotPainter())),

              // Gold radial glow — top-end corner (expanded only)
              PositionedDirectional(
                top: 0, end: -30,
                child: Opacity(
                  opacity: expandedAlpha,
                  child: Container(
                    width: 200, height: 200,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [Color(0x22C8A24B), Color(0x00C8A24B)],
                      ),
                    ),
                  ),
                ),
              ),

              // Gold hairline — bottom edge (expanded only)
              Positioned(
                bottom: 0, left: 40, right: 40,
                child: Opacity(
                  opacity: expandedAlpha,
                  child: Container(
                    height: 1,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [
                        Colors.transparent,
                        AppPalette.gold400.withValues(alpha: 0.50),
                        Colors.transparent,
                      ]),
                    ),
                  ),
                ),
              ),

              // ── EXPANDED content ────────────────────────────────────────
              Opacity(
                opacity: expandedAlpha,
                child: OverflowBox(
                  maxHeight: double.infinity,
                  alignment: Alignment.topCenter,
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(AppSpacing.md, topPad + AppSpacing.xs, AppSpacing.md, AppSpacing.md),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Title / subtitle / chips
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                l10n.navHome,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 26,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.5,
                                  height: 1.15,
                                ),
                              ),
                              if (name != null) ...[
                                const SizedBox(height: 3),
                                Text(
                                  l10n.dashboardWelcomeUser(name!),
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.65),
                                    fontSize: 14,
                                    height: 1.3,
                                  ),
                                ),
                              ],
                              const SizedBox(height: 8),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  _CustomerRoleChip(
                                    label: hasProperty ? l10n.homeOwnerRole : l10n.accountRoleCustomer,
                                  ),
                                  const SizedBox(width: AppSpacing.xs),
                                  const _CustomerDateChip(),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        // Bell
                        const CustomerNotificationButton(size: 44),
                      ],
                    ),
                  ),
                ),
              ),

              // ── COLLAPSED mini-bar ──────────────────────────────────────
              Opacity(
                opacity: collapsedAlpha,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(AppSpacing.md, topPad + AppSpacing.sm, AppSpacing.md, AppSpacing.sm),
                  child: SizedBox(
                    height: 40,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          l10n.navHome,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                            height: 1.2,
                          ),
                        ),
                        const Spacer(),
                        const CustomerNotificationButton(size: 36),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _CustomerHeaderDelegate old) =>
      old.topPad != topPad || old.name != name || old.hasProperty != hasProperty;
}

class _HeaderDotPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 0.0; y < size.height + step; y += step) {
      for (var x = 0.0; x < size.width + step; x += step) {
        canvas.drawCircle(Offset(x, y), 1.3, paint);
      }
    }
  }
  @override bool shouldRepaint(_HeaderDotPainter _) => false;
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
    // The staff app's header: the company's mark, the headline, the bell,
    // the filter and the search.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent),
      child: HomeListHero(
        title: l10n.homeHeroTitle,
        subtitle: l10n.homeHeroSubtitle,
        leading: const BrandMark(size: 40),
        actions: [
          HomeHeroButton(
            key: const Key('home-filter'),
            icon: Icons.tune_rounded,
            tooltip: l10n.filtersTitle,
            active: _filterType != null,
            onTap: _openFilters,
          ),
          const _HeroBellButton(),
        ],
        bottom: HomeSearchField(
          controller: _search,
          hint: l10n.homeSearchHint,
          onSubmitted: _runSearch,
          onClear: _search.clear,
        ),
      ),
    );
  }
}

/// Frosted glass bell button composited on the dark hero image.
/// Reuses [GlassCircle]'s backdrop-blur treatment — the same surface that
/// powers favourite/compare overlays on project cards.
class _HeroBellButton extends StatelessWidget {
  const _HeroBellButton();

  @override
  Widget build(BuildContext context) =>
      HomeHeroButton(icon: AppIcons.notification, onTap: () => GoRouter.of(context).push('/login'));
}

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
                    ? LinearGradient(
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
              Icon(
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
            return Column(children: [
              for (final p in state.data!.take(3))
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: ProjectCard(project: p, onTap: () => context.push('/projects/${p.id}')),
                ),
            ]);
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

        return HomeSection(
          icon: Icons.grid_view_rounded,
          title: l10n.homeFeaturedUnits,
          action: l10n.viewAll,
          onAction: () => context.go('/units'),
          child: Column(children: [
            for (final u in units.take(3))
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: UnitCard(unit: u, onTap: () => context.push('/units/${u.id}')),
              ),
          ]),
        );
      },
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
                        Icon(
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
                          Icon(
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
                              Icon(
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
                              Icons.chevron_right_rounded,
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
