import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/catalog_status_label.dart';
import '../../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/broker_project.dart';
import '../cubit/broker_projects_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

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
                              const SizedBox(height: 10),
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
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return Container(
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
              color: Color(0x35000000), blurRadius: 22, offset: Offset(0, 8)),
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
              height: 120,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.10),
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
            padding: EdgeInsets.fromLTRB(AppSpacing.lg,
                topInset + AppSpacing.md, AppSpacing.lg, AppSpacing.xl),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        l10n.navProjects,
                        style: theme.textTheme.headlineSmall?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'المشاريع المتاحة لك',
                        style: TextStyle(
                          color: AppPalette.gold300,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ],
                  ),
                ),
                if (count != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppPalette.gold400.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: AppPalette.gold400.withValues(alpha: 0.4)),
                    ),
                    child: Text(
                      '$count',
                      style: const TextStyle(
                        color: AppPalette.gold300,
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
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

// ── Project card ──────────────────────────────────────────────────────────────

class _ProjectCard extends StatelessWidget {
  const _ProjectCard({required this.project});
  final BrokerProject project;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final name = project.name.resolve(lang);

    return GestureDetector(
      onTap: () =>
          context.push('/broker/projects/${project.id}', extra: project),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.07),
              blurRadius: 14,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            // Left accent rail
            Container(
              width: 4,
              height: 76,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [_navyLight, _navyDeep],
                ),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(16),
                  bottomLeft: Radius.circular(16),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Building avatar
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_navyLight, _navyDeep],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.apartment_rounded,
                  color: AppPalette.gold300, size: 22),
            ),
            const SizedBox(width: 12),
            // Text
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    name.isNotEmpty ? name : '—',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1A1A2E),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [
                      if (project.city != null) project.city!,
                      if (project.commissionPct != null)
                        '${l10n.brokerCommissionPct}: ${project.commissionPct}%',
                    ].join(' · '),
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFF6B7280),
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            StatusBadge(
              label: projectStatusLabel(l10n, project.status),
              tone: projectStatusTone(project.status),
            ),
            const SizedBox(width: 14),
          ],
        ),
      ),
    );
  }
}

// ── Dot texture ───────────────────────────────────────────────────────────────

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
