import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:go_router/go_router.dart';

import '../../../../../common/catalog_status_label.dart';
import '../../domain/entities/broker_project.dart';

const _navyDeep = Color(0xFF0B1726);

class BrokerUnitDetailScreen extends StatelessWidget {
  const BrokerUnitDetailScreen({super.key, required this.unit, this.projectId});

  final BrokerUnit unit;
  final String? projectId;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light
          .copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: Column(
          children: [
            _UnitDetailHeader(unit: unit, lang: lang, l10n: l10n),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
                children: [
                  _DetailsCard(unit: unit, l10n: l10n, lang: lang),
                  const SizedBox(height: 20),
                  _AddLeadButton(
                      unit: unit, projectId: projectId, l10n: l10n),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Unit detail header ────────────────────────────────────────────────────────

class _UnitDetailHeader extends StatelessWidget {
  const _UnitDetailHeader(
      {required this.unit, required this.lang, required this.l10n});
  final BrokerUnit unit;
  final String lang;
  final AppLocalizations l10n;

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
          colors: [Color(0xFF7C5200), Color(0xFF3D2800)],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
        boxShadow: [
          BoxShadow(
              color: Color(0x40000000), blurRadius: 22, offset: Offset(0, 8)),
        ],
      ),
      child: Stack(
        children: [
          const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
          PositionedDirectional(
            end: 0,
            top: 0,
            child: Container(
              width: 140,
              height: 110,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.14),
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
                        unit.code,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          StatusBadge(
                            label: unitStatusLabel(l10n, unit.status),
                            tone: unitStatusTone(unit.status),
                          ),
                          if (unit.price != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppPalette.gold400
                                    .withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                    color: AppPalette.gold400
                                        .withValues(alpha: 0.4)),
                              ),
                              child: Text(
                                PriceFormatter.formatString(unit.price,
                                    languageCode: lang),
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

// ── Details card ──────────────────────────────────────────────────────────────

class _DetailsCard extends StatelessWidget {
  const _DetailsCard(
      {required this.unit, required this.l10n, required this.lang});
  final BrokerUnit unit;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    if (unit.type != null) { rows.add(_row(l10n.unitType, unit.type!)); }
    if (unit.bedrooms != null) { rows.add(_row(l10n.unitBedrooms, '${unit.bedrooms}')); }
    if (unit.area != null) { rows.add(_row(l10n.unitArea, unit.area!)); }
    if (unit.price != null) {
      rows.add(_row(l10n.unitPrice,
          PriceFormatter.formatString(unit.price, languageCode: lang)));
    }

    if (rows.isEmpty) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 14,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: rows,
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF6B7280),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF1A1A2E),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Add lead button ───────────────────────────────────────────────────────────

class _AddLeadButton extends StatelessWidget {
  const _AddLeadButton(
      {required this.unit, required this.projectId, required this.l10n});
  final BrokerUnit unit;
  final String? projectId;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/broker/leads/new', extra: {
        'projectId': projectId,
        'unitId': unit.id,
      }),
      child: Container(
        height: 56,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppPalette.gold400, AppPalette.gold500],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.4),
              blurRadius: 16,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.person_add_alt_1_rounded,
                color: _navyDeep, size: 20),
            const SizedBox(width: 10),
            Text(
              l10n.brokerLeadNew,
              style: const TextStyle(
                color: _navyDeep,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
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
