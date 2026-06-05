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
        // Single source of bottom clearance (no extra trailing spacer below).
        // iOS: the floating dock overlays the body (extendBody) and stands
        // ~79px tall above the safe-area inset, so clear that plus a small gap
        // — anything less lets the dock cover the last content. Android: the
        // in-slot bar handles its own safe area, so just a small comfortable
        // gap above it.
        padding: EdgeInsets.only(
          bottom: context.isApplePlatform
              ? MediaQuery.of(context).padding.bottom + 84
              : AppSpacing.lg,
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
              child: _CustomerDashboard(
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

  /// Free-text search targets /projects (the only catalog route that reads a
  /// `?q=` query param on mobile; the units route takes no query).
  void _runSearch(String raw) {
    final query = raw.trim();
    context.push(
      query.isEmpty
          ? '/projects'
          : '/projects?q=${Uri.encodeQueryComponent(query)}',
    );
  }

  void _openFilters() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: context.appColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: AppRadii.sheet),
      builder: (sheetCtx) => _HomeFilterSheet(
        onType: (label) {
          Navigator.of(sheetCtx).pop();
          _runSearch(label);
        },
        onBrowseUnits: () {
          Navigator.of(sheetCtx).pop();
          context.push('/units');
        },
      ),
    );
  }

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
            // Base navy depth gradient — matches the website hero fallback
            // (130% 120% at 80% 10%).
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment(0.6, -0.8),
                    radius: 1.3,
                    colors: [_webNavyLight, _webNavyMid, _webNavyDeep],
                    stops: [0.0, 0.55, 1.0],
                  ),
                ),
              ),
            ),
            // Gold ambient glow behind the start-side content (RTL-aware).
            const Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: AlignmentDirectional(0.85, -0.6),
                      radius: 1.0,
                      colors: [Color(0x2BC8A24B), Color(0x00C8A24B)],
                      stops: [0.0, 0.6],
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

/// Home filter bottom sheet: property-type quick-search shortcuts (the mobile
/// catalog has no backend type filter, so these run a text search on /projects)
/// and a path into the full /units filters (price/status/area/bedrooms live
/// there). Kept honest — no faked filters.
class _HomeFilterSheet extends StatelessWidget {
  const _HomeFilterSheet({required this.onType, required this.onBrowseUnits});

  final ValueChanged<String> onType;
  final VoidCallback onBrowseUnits;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final types = [
      l10n.homeTypeResidential,
      l10n.homeTypeOffice,
      l10n.homeTypeCommercial,
      l10n.homeTypeMedical,
      l10n.homeTypeHotel,
    ];
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          0,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.homeFilterTypeLabel,
              style: theme.textTheme.titleMedium?.copyWith(
                color: colors.inkStrong,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                for (final t in types)
                  _TypeChip(label: t, onTap: () => onType(t)),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: l10n.homeFilterAllUnits,
              icon: Icons.tune_rounded,
              variant: AppButtonVariant.primary,
              expand: true,
              onPressed: onBrowseUnits,
            ),
          ],
        ),
      ),
    );
  }
}

/// A small tappable property-type quick-search pill (used inside the filter
/// sheet).
class _TypeChip extends StatelessWidget {
  const _TypeChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: colors.surfaceSoft,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadii.pillAll,
        side: BorderSide(color: colors.hairline.withValues(alpha: 0.7)),
      ),
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

/// A white-outline pill button for use on dark surfaces (the CTA band), where
/// the shared [AppButton] outline variant (dark ink/hairline) is invisible.
/// Mirrors the website's `variant="outline"` on navy (white border + white text).
class _GhostButton extends StatelessWidget {
  const _GhostButton({required this.label, this.icon, this.onPressed});

  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final textStyle = Theme.of(context).textTheme.labelLarge;
    return Material(
      color: Colors.white.withValues(alpha: 0.10),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadii.pillAll,
        side: BorderSide(
          color: Colors.white.withValues(alpha: 0.55),
          width: 1.4,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onPressed,
        child: SizedBox(
          height: 48,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 18, color: Colors.white),
                  const SizedBox(width: AppSpacing.xs),
                ],
                Flexible(
                  child: Text(
                    label,
                    style: textStyle?.copyWith(color: Colors.white),
                    overflow: TextOverflow.ellipsis,
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
