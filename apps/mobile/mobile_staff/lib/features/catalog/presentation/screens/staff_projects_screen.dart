import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/catalog_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/staff_project.dart';
import '../cubit/staff_projects_cubit.dart';

// ── Shared palette (mirrors customer projects screen) ─────────────────────────
const Color _navyLight = Color(0xFF24426A);
const Color _navyMid = Color(0xFF14273F);
const Color _navyDeep = Color(0xFF0B1726);

const _kAllStatus = '';
const _kStatuses = ['PUBLISHED', 'DRAFT', 'ARCHIVED'];

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class StaffProjectsScreen extends StatefulWidget {
  const StaffProjectsScreen({super.key});

  @override
  State<StaffProjectsScreen> createState() => _StaffProjectsScreenState();
}

class _StaffProjectsScreenState extends State<StaffProjectsScreen> {
  final _search = TextEditingController();
  String _statusFilter = _kAllStatus;

  @override
  void initState() {
    super.initState();
    context.read<StaffProjectsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<StaffProject> _filtered(List<StaffProject> all) {
    if (_statusFilter.isEmpty) return all;
    return all.where((p) => p.status == _statusFilter).toList();
  }

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<StaffProjectsCubit>();
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    final lang = Localizations.localeOf(context).languageCode;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: RefreshIndicator(
          onRefresh: cubit.load,
          child: BlocBuilder<StaffProjectsCubit, StaffProjectsState>(
            builder: (context, state) {
              final l10n = context.l10n;
              final visible = state.status == DataStatus.success
                  ? _filtered(state.projects)
                  : <StaffProject>[];

              return CustomScrollView(
                slivers: [
                  // ── Collapsing navy header (title + search) ────────────────
                  SliverPersistentHeader(
                    pinned: true,
                    delegate: _ProjectsHeaderDelegate(
                      topInset: topInset,
                      searchController: _search,
                      hasText: _search.text.isNotEmpty,
                      onSearchSubmit: (q) {
                        final query = q.trim();
                        setState(() {});
                        cubit.setSearch(query);
                      },
                      onSearchChange: (_) => setState(() {}),
                      onSearchClear: () {
                        _search.clear();
                        setState(() {});
                        cubit.setSearch('');
                      },
                      itemCount: state.status == DataStatus.success
                          ? visible.length
                          : null,
                    ),
                  ),

                  // ── Status filter chips ────────────────────────────────────
                  SliverToBoxAdapter(
                    child: _FilterStrip(
                      selected: _statusFilter,
                      lang: lang,
                      onSelected: (s) => setState(() => _statusFilter = s),
                    ),
                  ),

                  // ── State-dependent content ────────────────────────────────
                  ..._buildContent(
                    context: context,
                    state: state,
                    visible: visible,
                    l10n: l10n,
                    cubit: cubit,
                    bottomPad: bottomPad,
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  List<Widget> _buildContent({
    required BuildContext context,
    required StaffProjectsState state,
    required List<StaffProject> visible,
    required AppLocalizations l10n,
    required StaffProjectsCubit cubit,
    required double bottomPad,
  }) {
    switch (state.status) {
      case DataStatus.initial:
      case DataStatus.loading:
        return [const SliverFillRemaining(child: StaffListSkeleton())];

      case DataStatus.failure:
        return [
          SliverFillRemaining(
            child: ErrorState(failure: state.failure, onRetry: cubit.load),
          ),
        ];

      case DataStatus.empty:
        return [
          SliverFillRemaining(
            child: EmptyState(
              icon: Icons.apartment_outlined,
              title: l10n.projectsEmptyTitle,
              message: l10n.projectsEmptyMessage,
            ),
          ),
        ];

      case DataStatus.success:
        if (visible.isEmpty) {
          return [
            SliverFillRemaining(
              child: EmptyState(
                icon: Icons.apartment_outlined,
                title: l10n.projectsEmptyTitle,
                message: l10n.projectsEmptyMessage,
              ),
            ),
          ];
        }
        return [
          SliverPadding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              bottomPad + 100,
            ),
            sliver: SliverList.separated(
              itemCount: visible.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
              itemBuilder: (_, i) => _ProjectCard(project: visible[i]),
            ),
          ),
        ];
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsing header — navy gradient + dots + centered title + search field
// ─────────────────────────────────────────────────────────────────────────────

class _ProjectsHeaderDelegate extends SliverPersistentHeaderDelegate {
  const _ProjectsHeaderDelegate({
    required this.topInset,
    required this.searchController,
    required this.hasText,
    required this.onSearchSubmit,
    required this.onSearchChange,
    required this.onSearchClear,
    required this.itemCount,
  });

  final double topInset;
  final TextEditingController searchController;
  final bool hasText;
  final ValueChanged<String> onSearchSubmit;
  final ValueChanged<String> onSearchChange;
  final VoidCallback onSearchClear;
  final int? itemCount;

  static const double _titleH = 56.0;
  static const double _searchH = 60.0;

  @override
  double get minExtent => topInset + _titleH;
  @override
  double get maxExtent => topInset + _titleH + _searchH;

  @override
  bool shouldRebuild(_ProjectsHeaderDelegate old) =>
      old.topInset != topInset ||
      old.itemCount != itemCount ||
      old.hasText != hasText;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    final collapseRange = maxExtent - minExtent;
    final t = collapseRange > 0
        ? (shrinkOffset / collapseRange).clamp(0.0, 1.0)
        : 1.0;
    final searchOpacity = (1.0 - t * 1.6).clamp(0.0, 1.0);

    final theme = Theme.of(context);
    final l10n = context.l10n;

    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_navyLight, _navyMid, _navyDeep],
          stops: [0.0, 0.48, 1.0],
        ),
      ),
      child: Stack(
        children: [
          // Dot texture
          const Positioned.fill(
            child: IgnorePointer(child: _HeaderDots()),
          ),

          // ── Title row (always visible) ───────────────────────────────────
          Positioned(
            top: topInset,
            left: 0,
            right: 0,
            height: _titleH,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Leading: empty slot (tab screen — no back button)
                  const SizedBox(width: 44),
                  // Center: screen title
                  Expanded(
                    child: Center(
                      child: Text(
                        l10n.navProjects,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                  // Trailing: project count badge
                  SizedBox(
                    width: 44,
                    child: itemCount != null
                        ? Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: _CountBadge(count: itemCount!),
                          )
                        : null,
                  ),
                ],
              ),
            ),
          ),

          // ── Search row (fades out as header collapses) ───────────────────
          if (searchOpacity > 0)
            Positioned(
              top: topInset + _titleH,
              left: 0,
              right: 0,
              height: _searchH,
              child: Opacity(
                opacity: searchOpacity,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    0,
                    AppSpacing.lg,
                    AppSpacing.sm,
                  ),
                  child: _SearchField(
                    controller: searchController,
                    hint: l10n.projectsSearchHint,
                    hasText: hasText,
                    onChanged: onSearchChange,
                    onSubmitted: onSearchSubmit,
                    onClear: onSearchClear,
                  ),
                ),
              ),
            ),

          // ── Bottom gold hairline accent ──────────────────────────────────
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.0),
                    AppPalette.gold400.withValues(alpha: 0.45),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search field — styled to match CatalogSearchField from the customer app
// ─────────────────────────────────────────────────────────────────────────────

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.hint,
    required this.hasText,
    this.onChanged,
    this.onSubmitted,
    this.onClear,
  });

  final TextEditingController controller;
  final String hint;
  final bool hasText;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      height: 50,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.pillAll,
        border: Border.all(color: colors.hairline),
        boxShadow: colors.shadowSoft,
      ),
      child: Row(
        children: [
          const SizedBox(width: AppSpacing.md),
          Icon(Icons.search_rounded, size: 20, color: colors.inkMuted),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              onSubmitted: onSubmitted,
              textInputAction: TextInputAction.search,
              style: theme.textTheme.bodyMedium,
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
                hintText: hint,
                hintStyle: theme.textTheme.bodyMedium?.copyWith(
                  color: colors.inkMuted,
                ),
              ),
            ),
          ),
          if (hasText)
            IconButton(
              visualDensity: VisualDensity.compact,
              tooltip: MaterialLocalizations.of(context).cancelButtonLabel,
              icon: Icon(Icons.close_rounded, size: 18, color: colors.inkMuted),
              onPressed: onClear,
            ),
          const SizedBox(width: AppSpacing.xs),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Count badge — gold-outlined project count pill
// ─────────────────────────────────────────────────────────────────────────────

class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xs + 2,
        vertical: 3,
      ),
      decoration: BoxDecoration(
        color: AppPalette.gold400.withValues(alpha: 0.18),
        borderRadius: AppRadii.pillAll,
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.45),
          width: 0.8,
        ),
      ),
      child: Text(
        '$count',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: AppPalette.gold300,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter strip — surface background with bottom separator, scrollable chips
// ─────────────────────────────────────────────────────────────────────────────

class _FilterStrip extends StatelessWidget {
  const _FilterStrip({
    required this.selected,
    required this.lang,
    required this.onSelected,
  });

  final String selected;
  final String lang;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(
          bottom: BorderSide(color: colors.hairline, width: 0.5),
        ),
      ),
      child: SizedBox(
        height: 42,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: 4,
          ),
          child: Row(
            children: [
              _FilterChip(
                label: l10n.leadsFilterAll,
                active: selected.isEmpty,
                onTap: () => onSelected(_kAllStatus),
              ),
              const SizedBox(width: AppSpacing.xs),
              for (final s in _kStatuses) ...[
                _FilterChip(
                  label: projectStatusLabel(l10n, s),
                  active: selected == s,
                  onTap: () => onSelected(selected == s ? _kAllStatus : s),
                ),
                if (s != _kStatuses.last) const SizedBox(width: AppSpacing.xs),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: 4,
        ),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          border: Border.all(
            color: active ? colors.brandNavy : colors.hairline,
          ),
          borderRadius: AppRadii.pillAll,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            color: active ? Colors.white : colors.inkStrong,
            height: 1.2,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dot texture (navy header background)
// ─────────────────────────────────────────────────────────────────────────────

class _HeaderDots extends StatelessWidget {
  const _HeaderDots();
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

// ─────────────────────────────────────────────────────────────────────────────
// Project card — premium cinematic card (current approved direction)
// ─────────────────────────────────────────────────────────────────────────────

class _ProjectCard extends StatelessWidget {
  const _ProjectCard({required this.project});
  final StaffProject project;

  static const double _imageHeight = 220;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);

    final name = project.name.resolve(lang);
    final description = project.description?.resolve(lang).trim() ?? '';
    final city = project.city?.trim() ?? '';

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: colors.shadowCard,
      ),
      child: Material(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () =>
              context.push('/projects/${project.id}', extra: project),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Cinematic hero ──────────────────────────────────────────
              SizedBox(
                height: _imageHeight,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    AppNetworkImage(url: project.coverImageUrl),
                    const Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Color(0x33000000),
                              Color(0x00000000),
                              Color(0xBB000000),
                              Color(0xF0000000),
                            ],
                            stops: [0.0, 0.28, 0.66, 1.0],
                          ),
                        ),
                      ),
                    ),
                    PositionedDirectional(
                      top: AppSpacing.sm,
                      end: AppSpacing.sm,
                      child: StatusBadge(
                        label: projectStatusLabel(l10n, project.status),
                        tone: projectStatusTone(project.status),
                        variant: BadgeVariant.solid,
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
                          if (city.isNotEmpty) ...[
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                    color: AppPalette.gold400,
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: AppPalette.gold400
                                            .withValues(alpha: 0.6),
                                        blurRadius: 6,
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.xs),
                                Text(
                                  city.toUpperCase(),
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: AppPalette.gold300,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1.6,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.xxs),
                          ],
                          Text(
                            name,
                            style: theme.textTheme.headlineSmall?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              height: 1.1,
                              letterSpacing: -0.3,
                              shadows: const [
                                Shadow(color: Color(0x55000000), blurRadius: 10),
                              ],
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // ── Gold-start divider ──────────────────────────────────────
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

              // ── White content body ──────────────────────────────────────
              Container(
                color: colors.surface,
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (description.isNotEmpty) ...[
                      Text(
                        description,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: colors.inkMuted,
                          height: 1.6,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    Row(
                      children: [
                        if (project.availableUnitsCount != null)
                          _AvailableChip(count: project.availableUnitsCount!),
                        const Spacer(),
                        if (project.startingPrice != null)
                          _PriceTag(
                            price: project.startingPrice!,
                            lang: lang,
                            l10n: l10n,
                          ),
                      ],
                    ),
                    if (project.unitTypes.isNotEmpty ||
                        project.totalUnitsCount != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      _UnitMetaRow(
                        types: project.unitTypes,
                        total: project.totalUnitsCount,
                      ),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    SizedBox(
                      width: double.infinity,
                      child: AppButton(
                        label: l10n.viewUnits,
                        icon: Icons.grid_view_rounded,
                        variant: AppButtonVariant.gold,
                        size: AppButtonSize.small,
                        onPressed: () => context.push(
                          '/projects/${project.id}',
                          extra: project,
                        ),
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

// ─────────────────────────────────────────────────────────────────────────────
// Available units chip
// ─────────────────────────────────────────────────────────────────────────────

class _AvailableChip extends StatelessWidget {
  const _AvailableChip({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final has = count > 0;
    final fg = has ? colors.brandGold : colors.inkMuted;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: has
            ? colors.brandGold.withValues(alpha: 0.10)
            : colors.surfaceSoft,
        borderRadius: AppRadii.pillAll,
        border: Border.all(
          color: has
              ? colors.brandGold.withValues(alpha: 0.30)
              : colors.hairline,
          width: 0.8,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(AppIcons.property, size: 14, color: fg),
          const SizedBox(width: AppSpacing.xxs),
          Text(
            context.l10n.availableUnitsCount(count),
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: fg,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Starting price tag
// ─────────────────────────────────────────────────────────────────────────────

class _PriceTag extends StatelessWidget {
  const _PriceTag({
    required this.price,
    required this.lang,
    required this.l10n,
  });

  final double price;
  final String lang;
  final AppLocalizations l10n;

  String _compact(double v) {
    final currency = lang == 'ar' ? ' ج.م' : ' EGP';
    if (v >= 1e6) {
      final m = v / 1e6;
      final suffix = lang == 'ar' ? 'م' : 'M';
      if (m == m.truncateToDouble()) return '${m.toInt()}$suffix$currency';
      return '${m.toStringAsFixed(1)}$suffix$currency';
    }
    if (v >= 1e3) {
      final suffix = lang == 'ar' ? 'ك' : 'K';
      return '${(v / 1e3).toInt()}$suffix$currency';
    }
    return '${v.toInt()}$currency';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          l10n.projectStartingFrom,
          style: TextStyle(
            fontSize: 10,
            color: colors.inkMuted,
            fontWeight: FontWeight.w500,
          ),
        ),
        Text(
          _compact(price),
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: colors.brandGold,
            height: 1.1,
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit types + total count row
// ─────────────────────────────────────────────────────────────────────────────

class _UnitMetaRow extends StatelessWidget {
  const _UnitMetaRow({required this.types, this.total});

  final List<String> types;
  final int? total;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return Row(
      children: [
        if (types.isNotEmpty) ...[
          Icon(Icons.category_outlined, size: 13, color: colors.brandGold),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              types.take(4).join(' • '),
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: colors.inkStrong,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ] else
          const Spacer(),
        if (total != null) ...[
          const SizedBox(width: AppSpacing.xs),
          Text(
            '${l10n.projectTotalLabel}: $total',
            style: TextStyle(
              fontSize: 11,
              color: colors.inkMuted,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ],
    );
  }
}
