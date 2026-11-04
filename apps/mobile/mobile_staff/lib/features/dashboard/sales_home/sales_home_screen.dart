import 'dart:math' as math;

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/lead_stage_label.dart';
import '../../../common/role_label.dart';
import '../../leads/domain/entities/lead.dart';
import '../../leads/presentation/follow_up_labels.dart';
import '../../notifications/presentation/widgets/notifications_bell.dart';
import 'sales_home_cubit.dart';
import 'sales_home_data.dart';

/// The sales rep's home (owner-approved design, 2026-11-04): the same figures
/// as their dashboard on the website, on the app's navy and gold.
class SalesHomeScreen extends StatefulWidget {
  const SalesHomeScreen({super.key, this.onSwitchTab});
  final void Function(int)? onSwitchTab;

  @override
  State<SalesHomeScreen> createState() => _SalesHomeScreenState();
}

class _SalesHomeScreenState extends State<SalesHomeScreen> {
  @override
  void initState() {
    super.initState();
    context.read<SalesHomeCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<SalesHomeCubit, SalesHomeState>(
          builder: (context, state) {
            final data = state.data;
            return RefreshIndicator(
              onRefresh: () => context.read<SalesHomeCubit>().load(),
              child: ListView(
                key: const Key('sales-home'),
                padding: EdgeInsets.only(bottom: bottom + 110),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  _Hero(data: data),
                  if (state.status == DataStatus.failure && data == null)
                    Padding(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: ErrorState(failure: state.failure, onRetry: () => context.read<SalesHomeCubit>().load()),
                    )
                  else if (data == null)
                    const Padding(
                      padding: EdgeInsets.only(top: 120),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else ...[
                    Transform.translate(offset: const Offset(0, -78), child: _GoalCard(perf: data.performance)),
                    Transform.translate(
                      offset: const Offset(0, -60),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const _Actions(),
                          _Figures(data: data),
                          _Attention(data: data, onLeads: () => widget.onSwitchTab?.call(1)),
                          _FollowUps(state: state),
                          _Agenda(state: state),
                          _Pipeline(stages: data.stages, onLeads: () => widget.onSwitchTab?.call(1)),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

/// "4.32 مليون" / "4.32 M": a figure and its unit, for the big numbers.
(String, String) _compact(num v, AppLocalizations l10n) {
  String f(num x) {
    final t = x.toStringAsFixed(2);
    return t.contains('.') ? t.replaceFirst(RegExp(r'\.?0+$'), '') : t;
  }
  if (v.abs() >= 1000000) return (f(v / 1000000), l10n.shMillion);
  if (v.abs() >= 1000) return (f(v / 1000), l10n.shThousand);
  return (f(v), '');
}

String _initials(String? name) {
  final parts = (name ?? '').trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '؟';
  if (parts.length == 1) return parts.first.characters.take(2).toString();
  return '${parts[0].characters.first}${parts[1].characters.first}';
}

DateTime _day(DateTime d) => DateTime(d.year, d.month, d.day);

const _navyGradient = LinearGradient(
  begin: AlignmentDirectional.topStart,
  end: AlignmentDirectional.bottomEnd,
  colors: [AppPalette.navy700, AppPalette.navy],
);
const _goldGradient = LinearGradient(
  begin: AlignmentDirectional.topStart,
  end: AlignmentDirectional.bottomEnd,
  colors: [AppPalette.gold300, AppPalette.gold500],
);

TextStyle _display(double size, Color color) =>
    TextStyle(fontFamily: AppTypography.displayFamily, fontWeight: FontWeight.w800, fontSize: size, color: color, height: 1.15);

// ── 1. Hero ──────────────────────────────────────────────────────────────────

class _Hero extends StatelessWidget {
  const _Hero({required this.data});
  final SalesHome? data;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final session = context.read<SessionCubit>().state.sessionOrNull;
    final name = (session?.displayName ?? '').trim();
    final parts = name.split(RegExp(r'\s+'));
    final first = parts.isEmpty ? name : parts.first;
    final rest = parts.length > 1 ? parts.sublist(1).join(' ') : '';
    final now = DateTime.now();
    final top = MediaQuery.paddingOf(context).top;
    final logo = data?.companyLogoUrl;
    final company = data?.companyName;

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(36)),
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppPalette.navy700, AppPalette.navy, Color(0xFF0B1727)],
          ),
        ),
        child: Stack(
          children: [
            const Positioned.fill(child: CustomPaint(painter: _HeroPainter())),
            Padding(
              padding: EdgeInsets.fromLTRB(18, top + 14, 18, 100),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (logo != null || company != null) ...[
                        Container(
                          width: 36,
                          height: 36,
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(11)),
                          alignment: Alignment.center,
                          child: logo != null
                              ? Image.network(logo, fit: BoxFit.contain, errorBuilder: (_, _, _) => _LogoInitials(company))
                              : _LogoInitials(company),
                        ),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Text(
                            company ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: AppPalette.gold200, fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ] else
                        const Spacer(),
                      const NotificationsBell(),
                    ],
                  ),
                  const SizedBox(height: 22),
                  Text(now.hour < 12 ? l10n.shGreetMorning : l10n.shGreetEvening,
                      style: const TextStyle(color: Color(0xFFC9D2DE), fontSize: 13)),
                  const SizedBox(height: 2),
                  Text.rich(
                    TextSpan(children: [
                      TextSpan(text: first, style: _display(30, Colors.white)),
                      if (rest.isNotEmpty) TextSpan(text: ' $rest', style: _display(30, AppPalette.gold300)),
                    ]),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _HeroTag(
                        gold: true,
                        icon: Icons.verified_rounded,
                        label: roleLabel(l10n, context.read<SessionCubit>().state.role),
                      ),
                      _HeroTag(
                        icon: Icons.calendar_today_rounded,
                        label: '${DateFormatter.weekdayShort(now, languageCode: lang)} ${DateFormatter.dayMonth(now, languageCode: lang)}',
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LogoInitials extends StatelessWidget {
  const _LogoInitials(this.name);
  final String? name;

  @override
  Widget build(BuildContext context) =>
      Text(_initials(name), style: _display(13, AppPalette.navy));
}

class _HeroTag extends StatelessWidget {
  const _HeroTag({required this.icon, required this.label, this.gold = false});
  final IconData icon;
  final String label;
  final bool gold;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
        decoration: BoxDecoration(
          gradient: gold ? _goldGradient : null,
          color: gold ? null : Colors.white.withValues(alpha: 0.07),
          border: gold ? null : Border.all(color: Colors.white.withValues(alpha: 0.12)),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: gold ? AppPalette.navy : const Color(0xFFDCE3EC)),
            const SizedBox(width: 5),
            Text(label,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: gold ? AppPalette.navy : const Color(0xFFDCE3EC),
                )),
          ],
        ),
      );
}

/// The hero's backdrop: a faint gold grid fading down, a warm glow, and a
/// thin skyline along the bottom.
class _HeroPainter extends CustomPainter {
  const _HeroPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final glow = Paint()
      ..shader = RadialGradient(colors: [AppPalette.gold400.withValues(alpha: 0.26), Colors.transparent])
          .createShader(Rect.fromCircle(center: Offset(size.width * 0.05, -20), radius: 180));
    canvas.drawCircle(Offset(size.width * 0.05, -20), 180, glow);

    final grid = Paint()..strokeWidth = 1;
    for (double y = 0; y < size.height; y += 26) {
      grid.color = AppPalette.gold300.withValues(alpha: 0.06 * (1 - y / size.height));
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    for (double x = 0; x < size.width; x += 26) {
      grid.shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [AppPalette.gold300.withValues(alpha: 0.06), Colors.transparent],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }

    final sky = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.3
      ..color = AppPalette.gold300.withValues(alpha: 0.30);
    final base = size.height;
    final rnd = math.Random(7);
    final path = Path()..moveTo(0, base);
    double x = 0;
    while (x < size.width) {
      final w = 14.0 + rnd.nextInt(16);
      final h = 16.0 + rnd.nextInt(44);
      path
        ..lineTo(x, base - h)
        ..lineTo(x + w, base - h)
        ..lineTo(x + w, base);
      x += w + 2;
    }
    canvas.drawPath(path, sky);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ── 2. Target card ───────────────────────────────────────────────────────────

class _GoalCard extends StatelessWidget {
  const _GoalCard({required this.perf});
  final SalesPerformanceRow? perf;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final now = DateTime.now();
    final daysLeft = DateTime(now.year, now.month + 1, 0).day - now.day;
    final p = perf;
    final pct = (p?.targetPercent ?? 0).clamp(0, 999);
    final (achieved, unit) = _compact(p?.achievedAmount ?? 0, l10n);
    final (target, tUnit) = _compact(p?.targetAmount ?? 0, l10n);
    final currency = PriceFormatter.symbol(lang);

    return Container(
      key: const Key('sales-home-goal'),
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0xFFEFE6D4)),
        boxShadow: [BoxShadow(color: AppPalette.navy.withValues(alpha: 0.16), blurRadius: 40, offset: const Offset(0, 18))],
      ),
      child: p == null || !p.hasTarget
          ? Row(
              children: [
                const Icon(Icons.flag_rounded, color: AppPalette.gold500),
                const SizedBox(width: AppSpacing.sm),
                Expanded(child: Text(l10n.shNoTarget, style: TextStyle(color: context.appColors.inkMuted))),
              ],
            )
          : Row(
              children: [
                SizedBox(
                  width: 92,
                  height: 92,
                  child: CustomPaint(
                    painter: _RingPainter(pct / 100, track: context.appColors.surfaceSoft),
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(ltr('$pct%'), style: _display(24, context.appColors.inkStrong)),
                          Text(l10n.shOfGoal, style: TextStyle(fontSize: 10, color: context.appColors.inkMuted)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        const Icon(Icons.flag_rounded, size: 15, color: AppPalette.gold500),
                        const SizedBox(width: 5),
                        Text(l10n.shGoalTitle, style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
                      ]),
                      const SizedBox(height: 2),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: AlignmentDirectional.centerStart,
                        child: Text.rich(TextSpan(children: [
                          TextSpan(text: '${ltr(achieved)} $unit', style: _display(26, context.appColors.inkStrong)),
                          TextSpan(
                            text: '  ${l10n.shOfTarget('${ltr(target)} $tUnit $currency')}',
                            style: TextStyle(fontSize: 12.5, color: context.appColors.inkMuted),
                          ),
                        ])),
                      ),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(child: _MiniStat(label: l10n.shGoalUnits, value: ltr('${p.achievedUnits} / ${p.targetUnits ?? 0}'))),
                        const SizedBox(width: 6),
                        Expanded(child: _MiniStat(label: l10n.shDaysLeftLabel, value: l10n.shDaysLeft(daysLeft))),
                      ]),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: AppPalette.gold50,
          border: Border.all(color: AppPalette.gold100),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 10.5, color: context.appColors.inkMuted)),
            Text(value, maxLines: 1,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppPalette.navy)),
          ],
        ),
      );
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.value, {required this.track});
  final double value;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 9.0;
    final rect = Offset.zero & size;
    final r = rect.deflate(stroke / 2);
    canvas.drawArc(r, 0, math.pi * 2, false, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = track);
    final sweep = math.pi * 2 * value.clamp(0.0, 1.0);
    if (sweep <= 0) return;
    canvas.drawArc(
      r,
      -math.pi / 2,
      sweep,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..shader = const SweepGradient(colors: [AppPalette.gold200, AppPalette.gold500]).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) => old.value != value || old.track != track;
}

// ── 3. Quick actions ─────────────────────────────────────────────────────────

class _Actions extends StatelessWidget {
  const _Actions();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    Widget action(String key, IconData icon, String label, String route, {bool gold = false}) => Expanded(
          child: InkWell(
            key: Key('sales-home-$key'),
            borderRadius: BorderRadius.circular(20),
            onTap: () => context.push(route),
            child: Column(
              children: [
                Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    gradient: gold ? _goldGradient : _navyGradient,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: (gold ? AppPalette.gold500 : AppPalette.navy).withValues(alpha: gold ? 0.32 : 0.22),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Icon(icon, size: 24, color: gold ? AppPalette.navy : AppPalette.gold300),
                ),
                const SizedBox(height: 7),
                Text(label,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: context.appColors.inkStrong)),
              ],
            ),
          ),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.lg, AppSpacing.md, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          action('add-lead', Icons.person_add_rounded, l10n.shActLead, '/leads/new', gold: true),
          action('visit', Icons.event_rounded, l10n.shActVisit, '/visits/new'),
          action('reservation', Icons.bookmark_add_rounded, l10n.shActReservation, '/reservations/new'),
          action('calculator', Icons.calculate_rounded, l10n.shActCalculator, '/calculator'),
        ],
      ),
    );
  }
}

// ── section shell ────────────────────────────────────────────────────────────

class _Section extends StatelessWidget {
  const _Section({required this.icon, required this.title, required this.child, this.action, this.onAction});
  final IconData icon;
  final String title;
  final Widget child;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 22, AppSpacing.md, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: AppPalette.gold50,
                    border: Border.all(color: AppPalette.gold100),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Icon(icon, size: 16, color: AppPalette.gold500),
                ),
                const SizedBox(width: 9),
                Expanded(child: Text(title, style: _display(18.5, context.appColors.inkStrong))),
                if (action != null)
                  InkWell(
                    onTap: onAction,
                    child: Row(children: [
                      Text(action!, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppPalette.gold600)),
                      const Icon(Icons.chevron_left_rounded, size: 18, color: AppPalette.gold600),
                    ]),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      );
}

BoxDecoration _card(BuildContext context, {double radius = 20}) => BoxDecoration(
      color: context.appColors.surface,
      border: Border.all(color: context.appColors.hairline),
      borderRadius: BorderRadius.circular(radius),
    );

// ── 4. Figures ───────────────────────────────────────────────────────────────

class _Figures extends StatelessWidget {
  const _Figures({required this.data});
  final SalesHome data;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final now = DateTime.now();
    final today = _day(now);
    final todayVisits = data.visits.where((v) => _day(v.at) == today).length;
    final expiring7 = data.expiringWithin7(now);
    final p = data.performance;
    final (realized, rUnit) = _compact(p?.realizedValue ?? 0, l10n);
    final avg = p?.averageDeal;
    final (avgV, avgUnit) = avg == null ? ('—', '') : _compact(avg, l10n);

    Widget bandFig(String key, int value, String label, String hint, {bool warn = false}) => Expanded(
          child: Column(
            key: Key('sales-home-fig-$key'),
            children: [
              Text(ltr('$value'), style: _display(28, Colors.white)),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFFC9D2DE))),
              const SizedBox(height: 5),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: warn ? AppPalette.warningLight.withValues(alpha: 0.22) : Colors.white.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(hint,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 10.5, color: warn ? const Color(0xFFF2C77E) : const Color(0xFFDCE3EC))),
              ),
            ],
          ),
        );

    Widget divider() => Container(width: 1, height: 60, color: Colors.white.withValues(alpha: 0.10));

    Widget tile(String label, String value, String unit, String sub) => Expanded(
          child: Container(
            padding: const EdgeInsets.all(11),
            decoration: _card(context, radius: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 11, color: context.appColors.inkMuted)),
                const SizedBox(height: 3),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: AlignmentDirectional.centerStart,
                  child: Text.rich(TextSpan(children: [
                    TextSpan(text: ltr(value), style: _display(21, context.appColors.inkStrong)),
                    if (unit.isNotEmpty)
                      TextSpan(text: ' $unit', style: TextStyle(fontSize: 11, color: context.appColors.inkMuted)),
                  ])),
                ),
                Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 10.5, color: context.appColors.inkMuted)),
              ],
            ),
          ),
        );

    final currency = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    return _Section(
      icon: Icons.insights_rounded,
      title: l10n.shFigures,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
            decoration: BoxDecoration(gradient: _navyGradient, borderRadius: BorderRadius.circular(24)),
            child: Row(
              children: [
                bandFig('open-leads', data.openLeads, l10n.shOpenLeads,
                    data.staleLeads > 0 ? l10n.shStaleN(data.staleLeads) : l10n.shAllFollowed,
                    warn: data.staleLeads > 0),
                divider(),
                bandFig('visits', data.visits.length, l10n.shUpcomingVisits, l10n.shTodayN(todayVisits)),
                divider(),
                bandFig('reservations', data.activeReservations, l10n.shActiveReservations,
                    expiring7 > 0 ? l10n.shExpiringN(expiring7) : l10n.shNoneExpiring,
                    warn: expiring7 > 0),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              tile(l10n.shContractsMonth, '${p?.signedContracts ?? 0}', '', l10n.shUnitsSoldN(p?.achievedUnits ?? 0)),
              const SizedBox(width: 8),
              tile(l10n.shRealized, realized, rUnit, currency),
              const SizedBox(width: 8),
              tile(l10n.shAvgDeal, avgV, avgUnit, avg == null ? '' : currency),
            ],
          ),
        ],
      ),
    );
  }
}

// ── 5. Needs attention ───────────────────────────────────────────────────────

class _Attention extends StatelessWidget {
  const _Attention({required this.data, required this.onLeads});
  final SalesHome data;
  final VoidCallback onLeads;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final expiring7 = data.expiringWithin7(DateTime.now());

    Widget card(String key, IconData icon, Color fg, Color bg, int count, String label, VoidCallback onTap) {
      final hot = count > 0 && key == 'stale';
      return Expanded(
        child: InkWell(
          key: Key('sales-home-att-$key'),
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Container(
            constraints: const BoxConstraints(minHeight: 128),
            padding: const EdgeInsets.all(11),
            decoration: hot
                ? BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0xFFFFF6E6), Color(0xFFFCEBCF)],
                    ),
                    border: Border.all(color: const Color(0xFFF1D9A8)),
                    borderRadius: BorderRadius.circular(20),
                  )
                : _card(context),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(color: hot ? AppPalette.warningLight : bg, borderRadius: BorderRadius.circular(11)),
                      child: Icon(icon, size: 18, color: hot ? Colors.white : fg),
                    ),
                    const Spacer(),
                    Icon(Icons.chevron_left_rounded, size: 18, color: context.appColors.inkMuted.withValues(alpha: 0.6)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(ltr('$count'),
                    style: _display(26, hot ? const Color(0xFF8A5A12) : context.appColors.inkStrong)),
                const SizedBox(height: 4),
                Text(label, style: TextStyle(fontSize: 11, height: 1.35, color: context.appColors.inkMuted)),
              ],
            ),
          ),
        ),
      );
    }

    return _Section(
      icon: Icons.priority_high_rounded,
      title: l10n.shAttention,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          card('stale', Icons.warning_rounded, AppPalette.warningLight, const Color(0xFFFBF1DF), data.staleLeads,
              l10n.shAttStale(kStaleAfterDays), onLeads),
          const SizedBox(width: 8),
          card('lapsing', Icons.timer_rounded, AppPalette.errorLight, const Color(0xFFF8E6E4), expiring7, l10n.shAttLapsing,
              () => context.push('/reservations')),
          const SizedBox(width: 8),
          card('unconfirmed', Icons.phone_in_talk_rounded, const Color(0xFF2F6FA8), const Color(0xFFE6EFF7),
              data.unconfirmedVisits, l10n.shAttUnconfirmed, () => context.push('/visits')),
        ],
      ),
    );
  }
}

// ── 6. Follow-ups ────────────────────────────────────────────────────────────

class _FollowUps extends StatelessWidget {
  const _FollowUps({required this.state});
  final SalesHomeState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final s = state.followUpSummary;
    final cubit = context.read<SalesHomeCubit>();

    Widget seg(FollowUpBucket b, String label, int n) {
      final on = state.followUpBucket == b;
      return InkWell(
        key: Key('sales-home-fu-${b.name}'),
        borderRadius: BorderRadius.circular(9),
        onTap: () => cubit.showFollowUps(b),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: on ? context.appColors.surface : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
            boxShadow: on ? [BoxShadow(color: AppPalette.navy.withValues(alpha: 0.08), blurRadius: 6, offset: const Offset(0, 2))] : null,
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                color: on ? context.appColors.inkStrong : context.appColors.inkMuted)),
            const SizedBox(width: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              decoration: BoxDecoration(color: AppPalette.gold100, borderRadius: BorderRadius.circular(6)),
              child: Text(ltr('$n'), style: const TextStyle(fontSize: 11, color: AppPalette.gold600)),
            ),
          ]),
        ),
      );
    }

    return _Section(
      icon: Icons.call_rounded,
      title: l10n.shFollowUps,
      action: l10n.shAll,
      onAction: () => context.push('/follow-ups'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(color: context.appColors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              seg(FollowUpBucket.overdue, l10n.shOverdue, s.overdue),
              seg(FollowUpBucket.today, l10n.shToday, s.today),
              seg(FollowUpBucket.upcoming, l10n.shUpcoming, s.upcoming),
            ]),
          ),
          const SizedBox(height: 10),
          if (state.followUpsLoading)
            const Padding(padding: EdgeInsets.all(AppSpacing.md), child: Center(child: CircularProgressIndicator()))
          else if (state.followUps.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: _card(context),
              child: Text(l10n.shNoFollowUps, style: TextStyle(color: context.appColors.inkMuted, fontSize: 13)),
            )
          else
            for (final f in state.followUps) _FollowUpTile(f: f, l10n: l10n, lang: lang),
        ],
      ),
    );
  }
}

class _FollowUpTile extends StatelessWidget {
  const _FollowUpTile({required this.f, required this.l10n, required this.lang});
  final FollowUp f;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final lead = f.lead;
    final at = lead.nextActionAt?.toLocal();
    final phone = lead.phone?.trim() ?? '';
    final tone = leadStageTone(lead.stage);
    final sub = [
      // followUpWhen already says the day and the time ("اليوم 12:02 م").
      if (at != null) followUpWhen(at, l10n, lang),
      if ((lead.nextActionNote ?? '').isNotEmpty) lead.nextActionNote!,
    ].join(' · ');
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          key: Key('sales-home-fu-lead-${lead.id}'),
          borderRadius: BorderRadius.circular(20),
          onTap: () => context.push('/leads/${lead.id}'),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: context.appColors.hairline),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Container(width: 3, height: 34, decoration: BoxDecoration(color: AppPalette.gold400, borderRadius: BorderRadius.circular(3))),
                const SizedBox(width: 9),
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(gradient: _navyGradient, borderRadius: BorderRadius.circular(15)),
                  alignment: Alignment.center,
                  child: Text(_initials(lead.fullName), style: _display(14, AppPalette.gold300)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Flexible(
                          child: Text(lead.fullName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: context.appColors.inkStrong)),
                        ),
                        const SizedBox(width: 6),
                        StatusBadge(label: leadStageLabel(l10n, lead.stage), tone: tone),
                      ]),
                      const SizedBox(height: 3),
                      Row(children: [
                        const Icon(Icons.schedule_rounded, size: 14, color: AppPalette.gold500),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 11.5, color: context.appColors.inkMuted)),
                        ),
                      ]),
                    ],
                  ),
                ),
                if (phone.isNotEmpty) ...[
                  _RoundBtn(
                    icon: Icons.chat_rounded,
                    bg: const Color(0xFFE8F4EC),
                    fg: const Color(0xFF1F8F55),
                    onTap: () => ContactActions.whatsApp(number: phone),
                  ),
                  const SizedBox(width: 6),
                  _RoundBtn(
                    icon: Icons.call_rounded,
                    bg: AppPalette.navy,
                    fg: AppPalette.gold300,
                    onTap: () => ContactActions.call(phone),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RoundBtn extends StatelessWidget {
  const _RoundBtn({required this.icon, required this.bg, required this.fg, required this.onTap});
  final IconData icon;
  final Color bg;
  final Color fg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: bg,
        borderRadius: BorderRadius.circular(13),
        child: InkWell(
          borderRadius: BorderRadius.circular(13),
          onTap: onTap,
          child: SizedBox(width: 38, height: 38, child: Icon(icon, size: 19, color: fg)),
        ),
      );
}

// ── 7. Agenda ────────────────────────────────────────────────────────────────

class _Agenda extends StatelessWidget {
  const _Agenda({required this.state});
  final SalesHomeState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final data = state.data!;
    final today = _day(DateTime.now());
    final days = [for (var i = 0; i < kAgendaDays; i++) today.add(Duration(days: i))];
    final selected = state.selectedDay ?? today;
    final events = [...data.visits, ...data.expiring]..sort((a, b) => a.at.compareTo(b.at));
    List<AgendaEvent> on(DateTime d) => events.where((e) => _day(e.at) == d).toList();
    final dayEvents = on(selected);
    final next = events.where((e) => _day(e.at).isAfter(selected)).firstOrNull;

    return _Section(
      icon: Icons.event_note_rounded,
      title: l10n.shAgenda,
      action: l10n.shAllAppointments,
      onAction: () => context.push('/calendar'),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: _card(context, radius: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                for (final d in days)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2.5),
                      child: InkWell(
                        key: Key('sales-home-day-${d.day}'),
                        borderRadius: BorderRadius.circular(15),
                        onTap: () => context.read<SalesHomeCubit>().selectDay(d),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            gradient: d == selected ? _navyGradient : null,
                            borderRadius: BorderRadius.circular(15),
                          ),
                          child: Column(children: [
                            Text(DateFormatter.weekdayShort(d, languageCode: lang),
                                maxLines: 1,
                                style: TextStyle(fontSize: 10, color: d == selected ? const Color(0xFFC9D2DE) : context.appColors.inkMuted)),
                            Text(ltr('${d.day}'), style: _display(18, d == selected ? Colors.white : context.appColors.inkStrong)),
                            const SizedBox(height: 2),
                            Container(
                              width: 5,
                              height: 5,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: on(d).isEmpty ? Colors.transparent : (d == selected ? AppPalette.gold300 : AppPalette.gold400),
                              ),
                            ),
                          ]),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            if (dayEvents.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 14, bottom: 4),
                child: Text(l10n.shDayEmpty, textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12.5, color: context.appColors.inkMuted)),
              )
            else
              for (final e in dayEvents) _EventTile(e: e, lang: lang, l10n: l10n),
            if (next != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: context.appColors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.update_rounded, size: 15, color: AppPalette.gold500),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      l10n.shNextUp(
                        '${DateFormatter.weekdayShort(next.at, languageCode: lang)} ${DateFormatter.dayMonth(next.at, languageCode: lang)} — '
                        '${next.kind == AgendaKind.visit ? l10n.shTagVisit : l10n.shTagExpiry} ${next.title}',
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: context.appColors.inkMuted),
                    ),
                  ),
                ]),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.e, required this.lang, required this.l10n});
  final AgendaEvent e;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final visit = e.kind == AgendaKind.visit;
    final time = clockTime(e.at, lang).split(' ');
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 54,
            child: Column(children: [
              Text(ltr(time.first), style: _display(18, context.appColors.inkStrong)),
              if (time.length > 1) Text(time.last, style: TextStyle(fontSize: 10.5, color: context.appColors.inkMuted)),
            ]),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: InkWell(
              key: Key('sales-home-event-${e.id}'),
              borderRadius: BorderRadius.circular(18),
              onTap: () => context.push(visit ? '/visits/${e.id}' : '/reservations/${e.id}'),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  gradient: visit ? _navyGradient : null,
                  color: visit ? null : const Color(0xFFF8E6E4),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
                      decoration: BoxDecoration(
                        color: visit ? AppPalette.gold300 : AppPalette.errorLight,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        visit ? (e.confirmed ? '${l10n.shTagVisit} · ${l10n.shConfirmed}' : l10n.shTagVisit) : l10n.shTagExpiry,
                        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: visit ? AppPalette.navy : Colors.white),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(e.title,
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: visit ? Colors.white : context.appColors.inkStrong)),
                    for (final (icon, line) in [
                      if (e.project != null) (Icons.apartment_rounded, e.project!.resolve(lang)),
                      if (e.unitCode != null) (Icons.home_work_rounded, ltr(e.unitCode!)),
                      if (e.place != null && e.place!.isNotEmpty) (visit ? Icons.location_on_rounded : Icons.bookmark_rounded, e.place!),
                    ])
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(children: [
                          Icon(icon, size: 14, color: visit ? AppPalette.gold300 : AppPalette.errorLight),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(line, maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 11.5, color: visit ? const Color(0xFFC9D2DE) : context.appColors.inkMuted)),
                          ),
                        ]),
                      ),
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

// ── 8. Pipeline ──────────────────────────────────────────────────────────────

class _Pipeline extends StatelessWidget {
  const _Pipeline({required this.stages, required this.onLeads});
  final Map<String, int> stages;
  final VoidCallback onLeads;

  static const _open = ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION'];
  static const _fills = {
    'NEW': [Color(0xFF8A7F70), Color(0xFF6B6256)],
    'INTERESTED': [AppPalette.navy600, AppPalette.navy],
    'VISIT': [AppPalette.gold300, AppPalette.gold500],
    'NEGOTIATION': [Color(0xFFDDA14A), AppPalette.warningLight],
  };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final max = _open.map((s) => stages[s] ?? 0).fold<int>(1, (m, v) => v > m ? v : m);
    return _Section(
      icon: Icons.filter_alt_rounded,
      title: l10n.shPipeline,
      action: l10n.shLeadsLink,
      onAction: onLeads,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: _card(context, radius: 24),
        child: Column(
          children: [
            for (final s in _open)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4.5),
                child: Row(children: [
                  SizedBox(
                    width: 56,
                    child: Text(leadStageLabel(l10n, s), style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
                  ),
                  Expanded(
                    child: Container(
                      height: 30,
                      decoration: BoxDecoration(color: context.appColors.surfaceSoft, borderRadius: BorderRadius.circular(10)),
                      child: FractionallySizedBox(
                        key: Key('sales-home-stage-$s'),
                        alignment: AlignmentDirectional.centerStart,
                        widthFactor: ((stages[s] ?? 0) / max).clamp(0.12, 1.0),
                        child: Container(
                          alignment: AlignmentDirectional.centerEnd,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(colors: _fills[s]!),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(ltr('${stages[s] ?? 0}'),
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                        ),
                      ),
                    ),
                  ),
                ]),
              ),
          ],
        ),
      ),
    );
  }
}
