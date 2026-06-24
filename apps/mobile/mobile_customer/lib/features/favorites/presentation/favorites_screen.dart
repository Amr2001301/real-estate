import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../catalog/presentation/widgets/glass.dart';
import '../domain/entities/favorite.dart';
import 'favorites_cubit.dart';

// ─── palette ──────────────────────────────────────────────────────────────────
const _navyDeep  = Color(0xFF0B1726);
const _navyCard  = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─── local filter ─────────────────────────────────────────────────────────────
enum _FilterTab { all, units, projects }

// ─────────────────────────────────────────────────────────────────────────────
// Favorites Screen
// ─────────────────────────────────────────────────────────────────────────────
class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  _FilterTab _filter = _FilterTab.all;

  List<Favorite> _apply(List<Favorite> all) => switch (_filter) {
        _FilterTab.all      => all,
        _FilterTab.units    => all.where((f) => !f.isProject).toList(),
        _FilterTab.projects => all.where((f) => f.isProject).toList(),
      };

  @override
  void initState() {
    super.initState();
    final cubit = context.read<FavoritesCubit>();
    if (cubit.state.status == DataStatus.initial) cubit.load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final bottom = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: Column(
        children: [
          // Header
          BlocBuilder<FavoritesCubit, FavoritesState>(
            buildWhen: (a, b) => a.status != b.status || a.items.length != b.items.length,
            builder: (context, state) => _Header(
              l10n: l10n,
              count: state.status == DataStatus.success ? state.items.length : null,
            ),
          ),

          // Filter row — visible only when there is a loaded list
          BlocBuilder<FavoritesCubit, FavoritesState>(
            buildWhen: (a, b) => a.status != b.status || a.items != b.items,
            builder: (context, state) {
              if (state.status != DataStatus.success) return const SizedBox.shrink();
              return _FilterRow(
                all: state.items,
                selected: _filter,
                onSelect: (t) => setState(() => _filter = t),
              );
            },
          ),

          // Body
          Expanded(
            child: BlocBuilder<FavoritesCubit, FavoritesState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const Center(child: CircularProgressIndicator());

                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => context.read<FavoritesCubit>().load(),
                    );

                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.favorite_border_rounded,
                      title: l10n.favoritesEmptyTitle,
                      message: l10n.favoritesEmptyMessage,
                    );

                  case DataStatus.success:
                    final lang    = Localizations.localeOf(context).languageCode;
                    final visible = _apply(state.items);

                    if (visible.isEmpty) {
                      return const EmptyState(
                        icon: Icons.filter_list_off_rounded,
                        title: 'لا توجد نتائج',
                        message: 'لا توجد عناصر محفوظة في هذا التصنيف',
                      );
                    }

                    return RefreshIndicator(
                      onRefresh: () => context.read<FavoritesCubit>().load(),
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(16, 12, 16, 96 + bottom),
                        itemCount: visible.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 16),
                        itemBuilder: (_, i) {
                          final fav = visible[i];
                          return _FavoriteCard(
                            fav: fav,
                            lang: lang,
                            onTap: () => context.push(fav.route),
                            onRemove: () =>
                                context.read<FavoritesCubit>().removeById(fav.id),
                          );
                        },
                      ),
                    );
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Header ───────────────────────────────────────────────────────────────────
class _Header extends StatelessWidget {
  const _Header({required this.l10n, this.count});
  final AppLocalizations l10n;
  final int? count;

  @override
  Widget build(BuildContext context) {
    final theme     = Theme.of(context);
    final topInset  = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [_navyLight, _navyCard, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(28),
            bottomRight: Radius.circular(28),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x35000000),
              blurRadius: 22,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 160,
                height: 130,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.09),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 48,
              right: 48,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.0),
                      AppPalette.gold400.withValues(alpha: 0.5),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                topInset + AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _BackBtn(),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.navFavorites,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'الوحدات المحفوظة',
                          style: TextStyle(
                            color: AppPalette.gold300,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (count != null) ...[
                    const SizedBox(width: AppSpacing.sm),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.favorite_rounded,
                            color: Color(0xFFF87171),
                            size: 13,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '$count',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                            ),
                          ),
                        ],
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

// ─── Filter row ───────────────────────────────────────────────────────────────
class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.all,
    required this.selected,
    required this.onSelect,
  });

  final List<Favorite> all;
  final _FilterTab     selected;
  final ValueChanged<_FilterTab> onSelect;

  @override
  Widget build(BuildContext context) {
    final unitCount    = all.where((f) => !f.isProject).length;
    final projectCount = all.where((f) => f.isProject).length;

    return Container(
      color: const Color(0xFFF5F7FA),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          _FilterChip(
            label: 'الكل',
            count: all.length,
            selected: selected == _FilterTab.all,
            onTap: () => onSelect(_FilterTab.all),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'وحدات',
            count: unitCount,
            selected: selected == _FilterTab.units,
            onTap: () => onSelect(_FilterTab.units),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'مشاريع',
            count: projectCount,
            selected: selected == _FilterTab.projects,
            onTap: () => onSelect(_FilterTab.projects),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String      label;
  final int         count;
  final bool        selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? _navyCard : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? _navyCard : const Color(0xFFE5E7EB),
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: _navyCard.withValues(alpha: 0.15),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : const Color(0xFF6B7280),
                fontSize: 14,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: selected
                      ? AppPalette.gold300.withValues(alpha: 0.25)
                      : const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    color: selected ? AppPalette.gold300 : const Color(0xFF9CA3AF),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Favorite card ────────────────────────────────────────────────────────────
class _FavoriteCard extends StatelessWidget {
  const _FavoriteCard({
    required this.fav,
    required this.lang,
    required this.onTap,
    required this.onRemove,
  });

  final Favorite     fav;
  final String       lang;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  // Icon based on type string detected from title+subtitle
  IconData _typeIcon() {
    final s =
        '${fav.title.resolve('en')} ${fav.subtitle ?? ''}'.toLowerCase();
    if (RegExp(r'\dbr\b|studio|apartment|villa|duplex').hasMatch(s)) {
      return Icons.home_rounded;
    }
    if (s.contains('office'))  return Icons.business_rounded;
    if (s.contains('retail') || s.contains('shop')) {
      return Icons.storefront_rounded;
    }
    return fav.isProject ? Icons.apartment_rounded : Icons.layers_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.appColors;

    final resolvedTitle = fav.title.resolve(lang);
    final subtitle      = fav.subtitle;

    // For UNIT favorites: unit type is the hero text; project name goes on
    // the image overlay.  For PROJECT favorites: project name is the hero;
    // city is the location detail.
    final String mainText;
    final String? overlayText;
    final String? detailText;
    final IconData? detailIcon;

    if (fav.isProject) {
      mainText    = resolvedTitle.isNotEmpty ? resolvedTitle : (subtitle ?? '—');
      overlayText = null;
      detailText  = subtitle;
      detailIcon  = Icons.location_on_rounded;
    } else {
      // Unit: prefer unit type (subtitle) as headline
      mainText    = subtitle ?? (resolvedTitle.isNotEmpty ? resolvedTitle : '—');
      overlayText = resolvedTitle.isNotEmpty ? resolvedTitle : null;
      detailText  = null;
      detailIcon  = null;
    }

    final pillLabel = fav.isProject ? 'مشروع' : (subtitle ?? 'وحدة');
    final ctaLabel  = fav.isProject ? 'عرض المشروع' : 'عرض الوحدة';

    return LuxeCard(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Cinematic image strip (180 px) ───────────────────────────────
          SizedBox(
            height: 180,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AppNetworkImage(url: fav.coverImage),
                const Positioned.fill(child: ImageScrim()),

                // Type / category pill — top-start (right in RTL)
                PositionedDirectional(
                  top: AppSpacing.sm,
                  start: AppSpacing.sm,
                  child: _TypePill(label: pillLabel, icon: _typeIcon()),
                ),

                // Heart remove button — top-end (left in RTL)
                PositionedDirectional(
                  top: AppSpacing.sm,
                  end: AppSpacing.sm,
                  child: GlassCircle(
                    child: IconButton(
                      padding: EdgeInsets.zero,
                      iconSize: 18,
                      visualDensity: VisualDensity.compact,
                      constraints:
                          const BoxConstraints.tightFor(width: 38, height: 38),
                      icon: const Icon(
                        Icons.favorite_rounded,
                        color: Color(0xFFF87171),
                      ),
                      onPressed: onRemove,
                    ),
                  ),
                ),

                // Project / context label — bottom overlay
                if (overlayText != null)
                  PositionedDirectional(
                    bottom: AppSpacing.md,
                    start: AppSpacing.md,
                    end: AppSpacing.md,
                    child: Row(
                      children: [
                        const Icon(
                          Icons.apartment_rounded,
                          size: 13,
                          color: AppPalette.gold300,
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            overlayText,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
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

          // ── Gold start divider (matches UnitCard language) ────────────────
          Row(
            children: [
              Container(
                width: 52,
                height: 2,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppPalette.gold400, Color(0x00B8941F)],
                  ),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Expanded(
                child: Container(height: 0.5, color: colors.hairline),
              ),
            ],
          ),

          // ── Content area ──────────────────────────────────────────────────
          Container(
            color: colors.surface,
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Main headline + saved pill
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Text(
                        mainText,
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: colors.inkStrong,
                          height: 1.1,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const _SavedPill(),
                  ],
                ),

                // Detail line (city for projects)
                if (detailText != null && detailText.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs + 2),
                  Row(
                    children: [
                      Icon(detailIcon, size: 13, color: colors.brandGold),
                      const SizedBox(width: AppSpacing.xxs + 2),
                      Expanded(
                        child: Text(
                          detailText,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: colors.inkMuted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: AppSpacing.sm),

                // CTA row
                Row(
                  children: [
                    _CtaButton(label: ctaLabel),
                    const Spacer(),
                    const CardOpenArrow(),
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

// ─── Small card widgets ───────────────────────────────────────────────────────

/// Frosted glass pill showing category (e.g. "2BR", "office", "مشروع").
class _TypePill extends StatelessWidget {
  const _TypePill({required this.label, required this.icon});

  final String   label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.38),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppPalette.gold300.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: AppPalette.gold300),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Gold bookmark "محفوظة" pill — compact, sits next to the headline.
class _SavedPill extends StatelessWidget {
  const _SavedPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppPalette.gold300.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppPalette.gold300.withValues(alpha: 0.35)),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.bookmark_rounded, size: 11, color: AppPalette.gold300),
          SizedBox(width: 4),
          Text(
            'محفوظة',
            style: TextStyle(
              color: AppPalette.gold300,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact navy gradient CTA — "عرض الوحدة" / "عرض المشروع".
class _CtaButton extends StatelessWidget {
  const _CtaButton({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_navyCard, _navyDeep],
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

// ─── Shared chrome ────────────────────────────────────────────────────────────
class _BackBtn extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.white,
          size: 16,
        ),
      ),
    );
  }
}

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
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
