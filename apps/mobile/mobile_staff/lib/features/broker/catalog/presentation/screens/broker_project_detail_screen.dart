import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/catalog_status_label.dart';
import '../../domain/entities/broker_project.dart';
import '../cubit/broker_units_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

class BrokerProjectDetailScreen extends StatefulWidget {
  const BrokerProjectDetailScreen({super.key, required this.project});
  final BrokerProject project;

  @override
  State<BrokerProjectDetailScreen> createState() =>
      _BrokerProjectDetailScreenState();
}

class _BrokerProjectDetailScreenState
    extends State<BrokerProjectDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerUnitsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final p = widget.project;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light
          .copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: Column(
          children: [
            _ProjectDetailHeader(project: p, lang: lang, l10n: l10n),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => context.read<BrokerUnitsCubit>().load(),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
                  children: [
                    _AddLeadCard(projectId: p.id, l10n: l10n),
                    const SizedBox(height: 16),
                    _SectionTitle(label: l10n.navUnits),
                    const SizedBox(height: 12),
                    _Units(projectId: p.id),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Project detail header ─────────────────────────────────────────────────────

class _ProjectDetailHeader extends StatelessWidget {
  const _ProjectDetailHeader(
      {required this.project, required this.lang, required this.l10n});
  final BrokerProject project;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;
    final name = project.name.resolve(lang);

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
                GestureDetector(
                  onTap: () => context.pop(),
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.2)),
                    ),
                    child: const Icon(Icons.arrow_back_ios_new_rounded,
                        color: Colors.white, size: 16),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        name.isNotEmpty ? name : l10n.navProjects,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          StatusBadge(
                            label: projectStatusLabel(l10n, project.status),
                            tone: projectStatusTone(project.status),
                          ),
                          if (project.city != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.location_on_rounded,
                                      size: 11,
                                      color:
                                          Colors.white.withValues(alpha: 0.7)),
                                  const SizedBox(width: 3),
                                  Text(
                                    project.city!,
                                    style: TextStyle(
                                      color:
                                          Colors.white.withValues(alpha: 0.7),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          if (project.commissionPct != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppPalette.gold400
                                    .withValues(alpha: 0.18),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                    color: AppPalette.gold400
                                        .withValues(alpha: 0.4)),
                              ),
                              child: Text(
                                '${project.commissionPct}%',
                                style: const TextStyle(
                                  color: AppPalette.gold300,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
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
        ],
      ),
    );
  }
}

// ── Add lead card ─────────────────────────────────────────────────────────────

class _AddLeadCard extends StatelessWidget {
  const _AddLeadCard({required this.projectId, required this.l10n});
  final String projectId;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context
          .push('/broker/leads/new', extra: {'projectId': projectId}),
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF7C5200), Color(0xFF3D2800)],
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF7C5200).withValues(alpha: 0.35),
              blurRadius: 14,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: AppPalette.gold300.withValues(alpha: 0.3)),
              ),
              child: const Icon(Icons.person_add_alt_1_rounded,
                  color: AppPalette.gold300, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.brokerLeadNew,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'إضافة عميل محتمل لهذا المشروع',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.55),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_back_ios_new_rounded,
                color: Colors.white.withValues(alpha: 0.5), size: 13),
          ],
        ),
      ),
    );
  }
}

// ── Section title ─────────────────────────────────────────────────────────────

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppPalette.gold400, AppPalette.gold300],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
      ],
    );
  }
}

// ── Units list ────────────────────────────────────────────────────────────────

class _Units extends StatelessWidget {
  const _Units({required this.projectId});
  final String projectId;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BlocBuilder<BrokerUnitsCubit, BrokerUnitsState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return const Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: Center(child: CircularProgressIndicator()),
            );
          case DataStatus.failure:
            return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<BrokerUnitsCubit>().load());
          case DataStatus.empty:
            return EmptyState(
              icon: Icons.door_front_door_outlined,
              title: l10n.unitsEmptyMessage,
            );
          case DataStatus.success:
            return Column(
              children: [
                for (final unit in state.data!) ...[
                  _UnitCard(unit: unit, projectId: projectId),
                  const SizedBox(height: 10),
                ],
              ],
            );
        }
      },
    );
  }
}

class _UnitCard extends StatelessWidget {
  const _UnitCard({required this.unit, required this.projectId});
  final BrokerUnit unit;
  final String projectId;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;

    return GestureDetector(
      onTap: () => context.push('/broker/units/${unit.id}',
          extra: {'unit': unit, 'projectId': projectId}),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 4,
              height: 64,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xFF7C5200), Color(0xFF3D2800)],
                ),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(14),
                  bottomLeft: Radius.circular(14),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF7C5200), Color(0xFF3D2800)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.door_front_door_rounded,
                  color: AppPalette.gold300, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    unit.code,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1A1A2E),
                    ),
                  ),
                  if (unit.type != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      [
                        unit.type!,
                        if (unit.price != null)
                          PriceFormatter.formatString(unit.price,
                              languageCode: lang),
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
                ],
              ),
            ),
            const SizedBox(width: 8),
            StatusBadge(
              label: unitStatusLabel(l10n, unit.status),
              tone: unitStatusTone(unit.status),
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
