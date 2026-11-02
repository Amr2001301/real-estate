import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/catalog_status_label.dart';
import '../../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/broker_project.dart';
import '../cubit/broker_projects_cubit.dart';


class BrokerProjectsScreen extends StatefulWidget {
  const BrokerProjectsScreen({super.key});

  @override
  State<BrokerProjectsScreen> createState() => _BrokerProjectsScreenState();
}

class _BrokerProjectsScreenState extends State<BrokerProjectsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerProjectsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<BrokerProjectsCubit>();

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light
          .copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: Column(
          children: [
            BlocBuilder<BrokerProjectsCubit, BrokerProjectsState>(
              buildWhen: (a, b) =>
                  a.status != b.status || a.data?.length != b.data?.length,
              builder: (context, state) =>
                  _ProjectsHeader(l10n: l10n, count: state.data?.length),
            ),
            Expanded(
              child: BlocBuilder<BrokerProjectsCubit, BrokerProjectsState>(
                builder: (context, state) {
                  switch (state.status) {
                    case DataStatus.initial:
                    case DataStatus.loading:
                      return const StaffListSkeleton();
                    case DataStatus.failure:
                      return ErrorState(
                          failure: state.failure, onRetry: cubit.load);
                    case DataStatus.empty:
                      return EmptyState(
                        icon: Icons.apartment_outlined,
                        title: l10n.projectsEmptyTitle,
                        message: l10n.brokerProjectsEmptyMessage,
                      );
                    case DataStatus.success:
                      return RefreshIndicator(
                        onRefresh: cubit.load,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
                          itemCount: state.data!.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: AppSpacing.lg),
                          itemBuilder: (context, i) =>
                              _ProjectCard(project: state.data![i]),
                        ),
                      );
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Projects header ───────────────────────────────────────────────────────────

class _ProjectsHeader extends StatelessWidget {
  const _ProjectsHeader({required this.l10n, this.count});
  final AppLocalizations l10n;
  final int? count;

  @override
  Widget build(BuildContext context) {
    return AppNavHeader(
      title: l10n.navProjects,
      subtitle: count != null ? '${l10n.brokerProjectsSubtitle} · $count' : l10n.brokerProjectsSubtitle,
      compact: true,
      leadingAction: Navigator.canPop(context) ? const NavHeaderBack() : null,
    );
  }
}

// ── Project card ──────────────────────────────────────────────────────────────

class _ProjectCard extends StatefulWidget {
  const _ProjectCard({required this.project});
  final BrokerProject project;

  @override
  State<_ProjectCard> createState() => _ProjectCardState();
}

class _ProjectCardState extends State<_ProjectCard> {
  bool _pressed = false;

  static const double _imageHeight = 236;
  static const _gold1 = Color(0xFFAA8528);
  static const _gold2 = Color(0xFFC8A24B);

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final name = widget.project.name.resolve(lang);
    final city = widget.project.city?.trim() ?? '';

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => context.push(
          '/broker/projects/${widget.project.id}',
          extra: widget.project),
      child: AnimatedScale(
        scale: _pressed ? 0.98 : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 18,
                offset: const Offset(0, 5),
              ),
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.06),
                blurRadius: 12,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Cinematic hero image ──────────────────────────────────────
              SizedBox(
                height: _imageHeight,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    AppNetworkImage(url: widget.project.coverImageUrl),
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
                              Color(0xF2000000),
                            ],
                            stops: [0.0, 0.28, 0.66, 1.0],
                          ),
                        ),
                      ),
                    ),
                    // Status badge — top end
                    PositionedDirectional(
                      top: AppSpacing.sm,
                      end: AppSpacing.sm,
                      child: StatusBadge(
                        label: projectStatusLabel(l10n, widget.project.status),
                        tone: projectStatusTone(widget.project.status),
                        variant: BadgeVariant.solid,
                      ),
                    ),
                    // Commission badge — top start
                    if (widget.project.commissionPct != null)
                      PositionedDirectional(
                        top: AppSpacing.sm,
                        start: AppSpacing.sm,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.50),
                            border: Border.all(
                              color: AppPalette.gold400.withValues(alpha: 0.55),
                              width: 0.8,
                            ),
                            borderRadius:
                                BorderRadius.circular(AppRadii.pill),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  color: AppPalette.gold300,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppPalette.gold300
                                          .withValues(alpha: 0.7),
                                      blurRadius: 4,
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                lang == 'ar'
                                    ? 'عمولة ${widget.project.commissionPct}%'
                                    : '${widget.project.commissionPct}% comm.',
                                style: const TextStyle(
                                  color: AppPalette.gold300,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.1,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    // City + project name — bottom
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
                                Shadow(
                                    color: Color(0x55000000),
                                    blurRadius: 10),
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

              // ── Gold-start divider ────────────────────────────────────────
              Row(
                children: [
                  Container(
                    width: 72,
                    height: 3,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppPalette.gold400, Color(0x00B8941F)],
                      ),
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: [
                        BoxShadow(
                          color: AppPalette.gold400.withValues(alpha: 0.35),
                          blurRadius: 6,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Container(height: 0.5, color: colors.hairline),
                  ),
                ],
              ),

              // ── Card footer: gold CTA button ──────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.md,
                ),
                child: Container(
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [_gold1, _gold2],
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                    ),
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    boxShadow: [
                      BoxShadow(
                        color: _gold1.withValues(alpha: 0.35),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.apartment_rounded,
                          size: 15,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        lang == 'ar' ? 'استعراض الوحدات' : 'View Units',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      const Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 12,
                        color: Colors.white,
                      ),
                    ],
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

// ── Dot texture ───────────────────────────────────────────────────────────────

