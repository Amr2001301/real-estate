import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/catalog_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../../../features/leads/domain/repositories/leads_repository.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_project_detail_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid  = Color(0xFF14273F);

// ══════════════════════════════════════════════════════════════════════════════
// Screen
// ══════════════════════════════════════════════════════════════════════════════
class StaffProjectDetailScreen extends StatefulWidget {
  const StaffProjectDetailScreen({super.key, this.fallback});
  final StaffProject? fallback;

  @override
  State<StaffProjectDetailScreen> createState() =>
      _StaffProjectDetailScreenState();
}

class _StaffProjectDetailScreenState
    extends State<StaffProjectDetailScreen> {
  String? _unitStatusFilter;
  final _scroll = ScrollController();
  final _unitsSectionKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    context.read<StaffProjectDetailCubit>().load();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final l10n = context.l10n;
    final colors = context.appColors;
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: BlocBuilder<StaffProjectDetailCubit, StaffProjectDetailState>(
          builder: (context, state) {
            if (state.status == DataStatus.initial ||
                state.status == DataStatus.loading) {
              return _LoadingView(
                topInset: topInset,
                fallback: widget.fallback,
                lang: lang,
                l10n: l10n,
              );
            }

            if (state.status == DataStatus.failure) {
              return _ErrorView(
                topInset: topInset,
                fallback: widget.fallback,
                lang: lang,
                l10n: l10n,
                onRetry: () =>
                    context.read<StaffProjectDetailCubit>().load(),
              );
            }

            final detail = state.data!;
            final p = detail.project;
            final description = detail.description?.resolve(lang);
            final name = p.name.resolve(lang);
            final units = detail.units;
            final allUnits =
                context.read<StaffProjectDetailCubit>().baseUnits;

            final availableUnits =
                allUnits.where((u) => u.status == 'AVAILABLE').toList();
            final startingPrice = availableUnits.isEmpty
                ? p.startingPrice
                : availableUnits
                    .map((u) =>
                        double.tryParse(u.price ?? '') ?? double.maxFinite)
                    .reduce((a, b) => a < b ? a : b)
                    .let((v) =>
                        v == double.maxFinite ? p.startingPrice : v);
            final totalCount =
                allUnits.isEmpty ? p.totalUnitsCount : allUnits.length;
            final availCount =
                availableUnits.isEmpty && p.availableUnitsCount != null
                    ? p.availableUnitsCount
                    : availableUnits.length;

            return CustomScrollView(
              controller: _scroll,
              slivers: [
                // ── Collapsible hero ────────────────────────────────────────
                SliverAppBar(
                  expandedHeight: 370,
                  pinned: true,
                  stretch: true,
                  backgroundColor: _navyDeep,
                  surfaceTintColor: Colors.transparent,
                  systemOverlayStyle: SystemUiOverlayStyle.light,
                  automaticallyImplyLeading: false,
                  leading: Padding(
                    padding: const EdgeInsets.all(8),
                    child: _CircleBackButton(
                        onTap: () => context.pop()),
                  ),
                  flexibleSpace: FlexibleSpaceBar(
                    collapseMode: CollapseMode.parallax,
                    stretchModes: const [StretchMode.zoomBackground],
                    titlePadding:
                        const EdgeInsetsDirectional.fromSTEB(
                            AppSpacing.xl, 0, AppSpacing.lg, AppSpacing.lg),
                    title: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: -0.3,
                        shadows: [
                          Shadow(color: Colors.black54, blurRadius: 10),
                        ],
                      ),
                    ),
                    background: _HeroBackground(
                      project: p,
                      statusLabel: projectStatusLabel(l10n, p.status),
                      statusTone: projectStatusTone(p.status),
                    ),
                  ),
                ),

                // ── Actions + stats + about + units header ──────────────────
                SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Staff actions
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                            AppSpacing.lg,
                            AppSpacing.xl,
                            AppSpacing.lg,
                            0),
                        child: const _StaffActions(),
                      ),

                      // Stats bar
                      if (availCount != null ||
                          totalCount != null ||
                          startingPrice != null) ...[
                        const SizedBox(height: AppSpacing.lg),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.lg),
                          child: _StatsBar(
                            available: availCount,
                            total: totalCount,
                            startingPrice: startingPrice,
                            lang: lang,
                            l10n: l10n,
                          ),
                        ),
                      ],

                      // About
                      if (description != null &&
                          description.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.xxl),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.lg),
                          child: _Section(
                            title: l10n.projectAbout,
                            child: _AboutBlock(text: description),
                          ),
                        ),
                      ],

                      // Units section header
                      const SizedBox(height: AppSpacing.xxl),
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.lg),
                        child: _Section(
                          key: _unitsSectionKey,
                          title: l10n.navUnits,
                          child: const SizedBox.shrink(),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                  ),
                ),

                // ── Unit filter chips ───────────────────────────────────────
                if (allUnits.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _UnitFilterRow(
                      selected: _unitStatusFilter,
                      totalCount: allUnits.length,
                      availableCount: allUnits
                          .where((u) => u.status == 'AVAILABLE')
                          .length,
                      reservedCount: allUnits
                          .where((u) => u.status == 'RESERVED')
                          .length,
                      soldCount: allUnits
                          .where((u) => u.status == 'SOLD')
                          .length,
                      onSelected: (v) {
                        setState(() => _unitStatusFilter = v);
                        context
                            .read<StaffProjectDetailCubit>()
                            .filterByStatus(v);
                      },
                      l10n: l10n,
                    ),
                  ),

                // ── Unit cards ──────────────────────────────────────────────
                if (units.isEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.lg,
                          vertical: AppSpacing.lg),
                      child: Center(
                        child: Text(
                          l10n.unitsEmptyMessage,
                          style: TextStyle(
                              fontSize: 14, color: colors.inkMuted),
                        ),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.lg,
                      AppSpacing.md,
                      AppSpacing.lg,
                      bottomInset + 100,
                    ),
                    sliver: SliverList.separated(
                      itemCount: units.length,
                      itemBuilder: (_, i) =>
                          _UnitCard(unit: units[i], projectId: p.id),
                      separatorBuilder: (_, _) =>
                          const SizedBox(height: AppSpacing.sm),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Loading view
// ══════════════════════════════════════════════════════════════════════════════
class _LoadingView extends StatelessWidget {
  const _LoadingView({
    required this.topInset,
    required this.fallback,
    required this.lang,
    required this.l10n,
  });

  final double topInset;
  final StaffProject? fallback;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _FallbackHeader(
          topInset: topInset,
          title: fallback?.name.resolve(lang) ?? l10n.navProjects,
          subtitle: fallback?.city,
        ),
        const Expanded(child: StaffListSkeleton()),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Error view
// ══════════════════════════════════════════════════════════════════════════════
class _ErrorView extends StatelessWidget {
  const _ErrorView({
    required this.topInset,
    required this.fallback,
    required this.lang,
    required this.l10n,
    required this.onRetry,
  });

  final double topInset;
  final StaffProject? fallback;
  final String lang;
  final AppLocalizations l10n;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _FallbackHeader(
          topInset: topInset,
          title: fallback?.name.resolve(lang) ?? l10n.navProjects,
          subtitle: fallback?.city,
        ),
        Expanded(
          child: ErrorState(
            failure: context
                .read<StaffProjectDetailCubit>()
                .state
                .failure,
            onRetry: onRetry,
          ),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Fallback header (loading / error only)
// ══════════════════════════════════════════════════════════════════════════════
class _FallbackHeader extends StatelessWidget {
  const _FallbackHeader({
    required this.topInset,
    required this.title,
    this.subtitle,
  });

  final double topInset;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          AppSpacing.md,
          topInset + AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.md),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [_navyMid, _navyDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Row(
        children: [
          _FallbackBackButton(),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700)),
                if (subtitle != null)
                  Text(subtitle!,
                      style: const TextStyle(
                          color: Colors.white60,
                          fontSize: 13,
                          fontWeight: FontWeight.w400)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FallbackBackButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          shape: BoxShape.circle,
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          size: 16,
          color: Colors.white,
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Glass circle back button (used in hero AppBar)
// ══════════════════════════════════════════════════════════════════════════════
class _CircleBackButton extends StatelessWidget {
  const _CircleBackButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.30),
            width: 0.8,
          ),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          size: 16,
          color: Colors.white,
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Hero background (used inside FlexibleSpaceBar)
// ══════════════════════════════════════════════════════════════════════════════
class _HeroBackground extends StatelessWidget {
  const _HeroBackground({
    required this.project,
    required this.statusLabel,
    required this.statusTone,
  });

  final StaffProject project;
  final String statusLabel;
  final BadgeTone statusTone;

  String? get _heroUrl =>
      project.coverImageUrl ??
      (project.mediaUrls.isNotEmpty ? project.mediaUrls.first : null);

  @override
  Widget build(BuildContext context) {
    final heroUrl = _heroUrl;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Image or placeholder
        if (heroUrl != null)
          AppNetworkImage(url: heroUrl)
        else
          _NoImagePlaceholder(),

        // Top gradient — protects back button
        const Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 160,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xCC000000), Color(0x00000000)],
                ),
              ),
            ),
          ),
        ),

        // Bottom gradient — behind the FlexibleSpaceBar title
        const Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: 160,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Color(0xEE050E18), Color(0x00000000)],
                ),
              ),
            ),
          ),
        ),

        // Status badge + media count at top-end (below toolbar row)
        PositionedDirectional(
          top: kToolbarHeight + 6,
          end: AppSpacing.lg,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (project.mediaUrls.length > 1) ...[
                _MediaCountPill(count: project.mediaUrls.length),
                const SizedBox(width: AppSpacing.xs),
              ],
              _StatusPill(label: statusLabel, tone: statusTone),
            ],
          ),
        ),

      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.tone});
  final String label;
  final BadgeTone tone;

  Color _bgColor() => switch (tone) {
        BadgeTone.success =>
          const Color(0xFF22C55E).withValues(alpha: 0.85),
        BadgeTone.warning =>
          const Color(0xFFF59E0B).withValues(alpha: 0.85),
        _ => Colors.black.withValues(alpha: 0.45),
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: _bgColor(),
        borderRadius: AppRadii.pillAll,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.25),
          width: 0.8,
        ),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _MediaCountPill extends StatelessWidget {
  const _MediaCountPill({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.40),
        borderRadius: AppRadii.pillAll,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.28),
          width: 0.8,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.photo_library_outlined,
              size: 12, color: Colors.white70),
          const SizedBox(width: 4),
          Text(
            '$count',
            style: const TextStyle(
                fontSize: 11, color: Colors.white70),
          ),
        ],
      ),
    );
  }
}

class _NoImagePlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: _navyDeep,
      child: Center(
        child: Icon(
          Icons.apartment_outlined,
          size: 64,
          color: Color(0x40FFFFFF),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Staff actions — primary row + secondary row
// ══════════════════════════════════════════════════════════════════════════════
class _StaffActions extends StatelessWidget {
  const _StaffActions();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return Row(
      children: [
        Expanded(
          child: _ActionBtn(
            icon: Icons.person_add_rounded,
            label: l10n.staffAddInterestedClient,
            bgColor: colors.brandNavy,
            fgColor: Colors.white,
            onTap: () {
              final detail = context
                  .read<StaffProjectDetailCubit>()
                  .state
                  .data;
              final lang =
                  Localizations.localeOf(context).languageCode;
              context.push(
                '/leads/new',
                extra: LeadInterestContext(
                  projectId: detail?.project.id,
                  projectName: detail?.project.name.resolve(lang) ??
                      detail?.project.id,
                ),
              );
            },
          ),
        ),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: _ActionBtn(
            icon: Icons.share_rounded,
            label: l10n.staffShareWithClient,
            bgColor: colors.brandGold.withValues(alpha: 0.08),
            fgColor: colors.brandGold,
            border: Border.all(
              color: colors.brandGold.withValues(alpha: 0.55),
              width: 1.3,
            ),
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(l10n.staffShareWithClient)),
            ),
          ),
        ),
      ],
    );
  }
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({
    required this.icon,
    required this.label,
    required this.bgColor,
    required this.fgColor,
    required this.onTap,
    this.border,
  });

  final IconData icon;
  final String label;
  final Color bgColor;
  final Color fgColor;
  final BoxBorder? border;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: bgColor,
      borderRadius: BorderRadius.circular(AppRadii.lg),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 15,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: border,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 17, color: fgColor),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: fgColor,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Stats bar — unified horizontal card with gold shimmer top bar
// ══════════════════════════════════════════════════════════════════════════════
class _StatsBar extends StatelessWidget {
  const _StatsBar({
    required this.lang,
    required this.l10n,
    this.available,
    this.total,
    this.startingPrice,
  });

  final String lang;
  final AppLocalizations l10n;
  final int? available;
  final int? total;
  final double? startingPrice;

  String _compactPrice(double price) {
    final currency = lang == 'ar' ? ' ج.م' : ' EGP';
    if (price >= 1e6) {
      final v = price / 1e6;
      final suffix = lang == 'ar' ? 'م' : 'M';
      final numStr = v == v.truncateToDouble()
          ? '${v.toInt()}$suffix'
          : '${v.toStringAsFixed(1)}$suffix';
      return '$numStr$currency';
    }
    if (price >= 1e3) {
      final suffix = lang == 'ar' ? 'ك' : 'K';
      return '${(price / 1e3).toInt()}$suffix$currency';
    }
    return '${price.toInt()}$currency';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    final items = <(IconData, String, String, Color)>[];
    if (total != null) {
      items.add((
        Icons.apartment_outlined,
        '$total',
        l10n.projectTotalLabel,
        colors.inkStrong,
      ));
    }
    if (startingPrice != null) {
      items.add((
        Icons.sell_outlined,
        _compactPrice(startingPrice!),
        l10n.projectStartingFrom,
        colors.brandGold,
      ));
    }
    if (available != null) {
      items.add((
        Icons.meeting_room_outlined,
        '$available',
        l10n.projectAvailableLabel,
        colors.success,
      ));
    }

    if (items.isEmpty) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
            color: colors.hairline.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Gold shimmer top bar
          Container(
            height: 2.5,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppPalette.gold300,
                  AppPalette.gold500,
                  AppPalette.gold300,
                ],
              ),
            ),
          ),
          // Stats row
          IntrinsicHeight(
            child: Row(
              children: [
                for (int i = 0; i < items.length; i++) ...[
                  if (i > 0)
                    VerticalDivider(
                      width: 1,
                      thickness: 0.5,
                      color: colors.hairline,
                    ),
                  Expanded(
                    child: _StatItem(
                      icon: items[i].$1,
                      value: items[i].$2,
                      label: items[i].$3,
                      color: items[i].$4,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  const _StatItem({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Padding(
      padding: const EdgeInsets.symmetric(
          vertical: 22, horizontal: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 22, color: color.withValues(alpha: 0.80)),
          const SizedBox(height: 10),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: color,
              letterSpacing: -0.5,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: colors.inkMuted,
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Section wrapper — gold-bar label + content
// ══════════════════════════════════════════════════════════════════════════════
class _Section extends StatelessWidget {
  const _Section({
    super.key,
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 4,
              height: 20,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [AppPalette.gold300, AppPalette.gold500],
                ),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: colors.inkStrong,
                    letterSpacing: -0.2,
                  ),
            ),
          ],
        ),
        if (child is! SizedBox) ...[
          const SizedBox(height: AppSpacing.md + 2),
          child,
        ],
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// About block — surfaceSoft container with gold left bar + expand/collapse
// ══════════════════════════════════════════════════════════════════════════════
class _AboutBlock extends StatefulWidget {
  const _AboutBlock({required this.text});
  final String text;

  @override
  State<_AboutBlock> createState() => _AboutBlockState();
}

class _AboutBlockState extends State<_AboutBlock> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
            color: colors.hairline.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 3,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [AppPalette.gold300, AppPalette.gold500],
                    ),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Flexible(
                  child: Text(
                    widget.text,
                    maxLines: _expanded ? null : 3,
                    overflow: _expanded
                        ? TextOverflow.visible
                        : TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.inkStrong
                          .withValues(alpha: 0.85),
                      height: 1.75,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          GestureDetector(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Text(
              _expanded ? l10n.showLess : l10n.showMore,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: colors.brandGold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Unit status filter row — matches projects/leads chip pattern
// ══════════════════════════════════════════════════════════════════════════════
class _UnitFilterRow extends StatelessWidget {
  const _UnitFilterRow({
    required this.selected,
    required this.totalCount,
    required this.availableCount,
    required this.reservedCount,
    required this.soldCount,
    required this.onSelected,
    required this.l10n,
  });

  final String? selected;
  final int totalCount;
  final int availableCount;
  final int reservedCount;
  final int soldCount;
  final ValueChanged<String?> onSelected;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    final chips = [
      (null, l10n.leadsFilterAll, totalCount, colors.brandGold),
      ('AVAILABLE', 'متاحة', availableCount, colors.success),
      ('RESERVED', 'محجوزة', reservedCount, colors.warning),
      ('SOLD', 'مباعة', soldCount, const Color(0xFFEF4444)),
    ];

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(
          bottom: BorderSide(color: colors.hairline, width: 0.5),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: 6,
        ),
        child: Row(
          children: [
            for (int i = 0; i < chips.length; i++) ...[
              if (i > 0) const SizedBox(width: AppSpacing.xs),
              _UnitStatusChip(
                label: chips[i].$2,
                count: chips[i].$3,
                dotColor: chips[i].$4,
                isSelected: selected == chips[i].$1,
                onTap: () => onSelected(chips[i].$1),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _UnitStatusChip extends StatelessWidget {
  const _UnitStatusChip({
    required this.label,
    required this.count,
    required this.dotColor,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final int count;
  final Color dotColor;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? colors.brandNavy : colors.surface,
          borderRadius: BorderRadius.circular(AppRadii.pill),
          border: isSelected
              ? null
              : Border.all(color: colors.hairline),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Count badge
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: isSelected
                    ? Colors.white.withValues(alpha: 0.18)
                    : colors.surfaceSoft,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: isSelected ? Colors.white : colors.inkMuted,
                ),
              ),
            ),
            if (!isSelected) ...[
              const SizedBox(width: 5),
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                ),
              ),
            ],
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isSelected ? Colors.white : colors.inkStrong,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Unit card — status accent bar + price hero + gradient send button
// ══════════════════════════════════════════════════════════════════════════════
class _UnitCard extends StatelessWidget {
  const _UnitCard({required this.unit, required this.projectId});
  final StaffUnit unit;
  final String projectId;

  static String _formatArea(String? raw) {
    final n = num.tryParse(raw ?? '');
    if (n == null) return raw ?? '';
    return n == n.truncateToDouble()
        ? n.toInt().toString()
        : n.toStringAsFixed(1);
  }

  Color _accentColor(AppColorsExt colors) => switch (unit.status) {
        'AVAILABLE' => colors.success,
        'RESERVED' => colors.warning,
        'SOLD' => const Color(0xFFEF4444),
        _ => colors.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final hasPrice = unit.price != null && unit.price!.isNotEmpty;
    final available = unit.status == 'AVAILABLE';
    final accent = _accentColor(colors);

    return GestureDetector(
      onTap: () =>
          context.push('/units/${unit.id}', extra: {'projectId': projectId}),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(
              color: colors.hairline.withValues(alpha: 0.6)),
          boxShadow: [
            BoxShadow(
              color: accent.withValues(alpha: 0.10),
              blurRadius: 18,
              offset: const Offset(0, 5),
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Status accent bar at start (right in RTL)
              Container(
                width: 4,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      accent.withValues(alpha: 0.65),
                      accent,
                    ],
                  ),
                ),
              ),
              // Card content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header: code + type + badge
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                          AppSpacing.md, AppSpacing.md,
                          AppSpacing.md, 0),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                Text(
                                  unit.code,
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w900,
                                    color: colors.inkStrong,
                                    letterSpacing: 0.2,
                                  ),
                                ),
                                if (unit.type != null) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    unit.type!,
                                    style: TextStyle(
                                        fontSize: 13,
                                        color: colors.inkMuted),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          StatusBadge(
                            label: unitStatusLabel(l10n, unit.status),
                            tone: unitStatusTone(unit.status),
                          ),
                        ],
                      ),
                    ),

                    // Price + specs
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                          AppSpacing.md, AppSpacing.sm,
                          AppSpacing.md, AppSpacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (hasPrice) ...[
                            Text(
                              PriceFormatter.formatString(unit.price,
                                  languageCode: lang),
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                color: available
                                    ? colors.brandGold
                                    : colors.inkMuted,
                                height: 1.2,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                          ],
                          Wrap(
                            spacing: AppSpacing.xs,
                            runSpacing: AppSpacing.xs,
                            children: [
                              if (unit.area != null)
                                _SpecPill(
                                  icon: Icons.square_foot_rounded,
                                  label: '${_formatArea(unit.area)} م²',
                                ),
                              if (unit.bedrooms != null &&
                                  unit.bedrooms! > 0)
                                _SpecPill(
                                  icon: Icons.bed_outlined,
                                  label: '${unit.bedrooms} ${l10n.unitBedrooms}',
                                ),
                              if (unit.floor != null)
                                _SpecPill(
                                  icon: Icons.layers_outlined,
                                  label: '${l10n.unitFloor} ${unit.floor}',
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Footer
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md, vertical: 12),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.07),
                        border: Border(
                          top: BorderSide(
                              color: accent.withValues(alpha: 0.15),
                              width: 0.5),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment:
                            MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                l10n.viewUnit,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: colors.brandGold,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Icon(
                                Icons.arrow_back_ios_new_rounded,
                                size: 12,
                                color: colors.brandGold,
                              ),
                            ],
                          ),
                          if (available) _SendChip(l10n: l10n),
                        ],
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

class _SendChip extends StatelessWidget {
  const _SendChip({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.staffSendToClient)),
        );
      },
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppPalette.gold300, AppPalette.gold500],
          ),
          borderRadius: AppRadii.pillAll,
          boxShadow: [
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.35),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.send_rounded,
                size: 12, color: Colors.white),
            const SizedBox(width: 5),
            Text(
              l10n.staffSendToClient,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Spec pill
// ══════════════════════════════════════════════════════════════════════════════
class _SpecPill extends StatelessWidget {
  const _SpecPill({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: colors.hairline),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.inkMuted),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: colors.inkStrong,
            ),
          ),
        ],
      ),
    );
  }
}

extension _DoubleX on double {
  T let<T>(T Function(double) fn) => fn(this);
}
