import 'dart:math' as math;

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../notifications/presentation/widgets/notifications_bell.dart';

/// The pieces every staff home is built of (owner-approved design,
/// 2026-11-04): the navy hero, the white card over its edge, the round
/// actions, titled sections, the navy band of figures, tiles, attention
/// cards, ranked lists, a funnel, bars and an activity list.

// ── helpers ──────────────────────────────────────────────────────────────────

/// "4.32 مليون" / "4.32 M": a figure and its unit, for the big numbers.
(String, String) homeCompact(num v, AppLocalizations l10n) {
  String f(num x) {
    final t = x.toStringAsFixed(2);
    return t.contains('.') ? t.replaceFirst(RegExp(r'\.?0+$'), '') : t;
  }

  if (v.abs() >= 1000000) return (f(v / 1000000), l10n.shMillion);
  if (v.abs() >= 1000) return (f(v / 1000), l10n.shThousand);
  return (f(v), '');
}

/// "4.32 مليون" in one string.
String homeCompactText(num v, AppLocalizations l10n) {
  final (n, u) = homeCompact(v, l10n);
  return u.isEmpty ? ltr(n) : '${ltr(n)} $u';
}

String homeInitials(String? name) {
  final parts = (name ?? '').trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '؟';
  if (parts.length == 1) return parts.first.characters.take(2).toString();
  // «الشناوي» reads «ش», not «ا» (the article is not the name).
  final second = parts[1].startsWith('ال') && parts[1].length > 2 ? parts[1].substring(2) : parts[1];
  return '${parts[0].characters.first}${second.characters.first}';
}

DateTime homeDay(DateTime d) => DateTime(d.year, d.month, d.day);

/// A percent of [part] in [whole], rounded; null when [whole] is 0.
int? homePercent(num part, num whole) => whole <= 0 ? null : (part / whole * 100).round();

const homeNavyGradient = LinearGradient(
  begin: AlignmentDirectional.topStart,
  end: AlignmentDirectional.bottomEnd,
  colors: [AppPalette.navy700, AppPalette.navy],
);
const homeGoldGradient = LinearGradient(
  begin: AlignmentDirectional.topStart,
  end: AlignmentDirectional.bottomEnd,
  colors: [AppPalette.gold300, AppPalette.gold500],
);

TextStyle homeDisplay(double size, Color color) =>
    TextStyle(fontFamily: AppTypography.displayFamily, fontWeight: FontWeight.w800, fontSize: size, color: color, height: 1.15);

/// A soft gold tile for facts under a price: the pale cream by day, a faint
/// gold wash on the dark theme (the cream there left white text on white).
Color homeTint(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark ? AppPalette.gold500.withValues(alpha: 0.14) : AppPalette.gold50;
Color homeTintBorder(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark ? AppPalette.gold500.withValues(alpha: 0.32) : AppPalette.gold100;

BoxDecoration homeCard(BuildContext context, {double radius = 20}) => BoxDecoration(
      color: context.appColors.surface,
      border: Border.all(color: context.appColors.hairline),
      borderRadius: BorderRadius.circular(radius),
    );

/// The page: the hero, then the card over its edge, then the sections.
class HomePage extends StatelessWidget {
  const HomePage({
    super.key,
    required this.pageKey,
    required this.hero,
    required this.loading,
    required this.onRefresh,
    this.failure,
    this.onRetry,
    this.overlap,
    this.children = const [],
  });

  final Key pageKey;
  final Widget hero;
  final bool loading;
  final AppFailure? failure;
  final VoidCallback? onRetry;
  final Future<void> Function() onRefresh;

  /// The white card drawn over the hero's bottom edge.
  final Widget? overlap;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          key: pageKey,
          padding: EdgeInsets.only(bottom: bottom + 110),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            // The card sits over the hero's last 78px with real layout, so
            // it (and the sections under it) take taps where they are drawn.
            if (!loading && overlap != null) HomeOverlap(overlap: 78, top: hero, bottom: overlap!) else hero,
            if (failure != null && loading == false && overlap == null && children.isEmpty)
              Padding(padding: const EdgeInsets.all(AppSpacing.lg), child: ErrorState(failure: failure, onRetry: onRetry))
            else if (loading)
              const Padding(padding: EdgeInsets.only(top: 120), child: Center(child: CircularProgressIndicator()))
            else ...[
              if (overlap != null) const SizedBox(height: 18), // as the old -78 card over -60 sections
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Hero ─────────────────────────────────────────────────────────────────────

class HomeHero extends StatelessWidget {
  const HomeHero({
    super.key,
    required this.name,
    required this.roleLabel,
    this.companyName,
    this.logoUrl,
    this.bellRoute = '/notifications',
  });

  final String name;
  final String roleLabel;
  final String? companyName;
  final String? logoUrl;
  final String bellRoute;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final parts = name.trim().split(RegExp(r'\s+'));
    final first = parts.isEmpty ? name : parts.first;
    final rest = parts.length > 1 ? parts.sublist(1).join(' ') : '';
    final now = DateTime.now();
    final top = MediaQuery.paddingOf(context).top;

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
                      if (logoUrl != null || companyName != null) ...[
                        Container(
                          width: 36,
                          height: 36,
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(11)),
                          alignment: Alignment.center,
                          child: logoUrl != null
                              ? Image.network(logoUrl!, fit: BoxFit.contain, errorBuilder: (_, _, _) => _LogoInitials(companyName))
                              : _LogoInitials(companyName),
                        ),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Text(
                            companyName ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: AppPalette.gold200, fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ] else
                        const Spacer(),
                      NotificationsBell(route: bellRoute),
                    ],
                  ),
                  const SizedBox(height: 22),
                  Text(now.hour < 12 ? l10n.shGreetMorning : l10n.shGreetEvening,
                      style: const TextStyle(color: Color(0xFFC9D2DE), fontSize: 13)),
                  const SizedBox(height: 2),
                  Text.rich(
                    TextSpan(children: [
                      TextSpan(text: first, style: homeDisplay(30, Colors.white)),
                      if (rest.isNotEmpty) TextSpan(text: ' $rest', style: homeDisplay(30, AppPalette.gold300)),
                    ]),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _HeroTag(gold: true, icon: Icons.verified_rounded, label: roleLabel),
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

/// The navy header of a list page, in the homes' look: the title and a
/// count, round actions, and what goes under (a search field, chips).
class HomeListHero extends StatelessWidget {
  const HomeListHero({super.key, required this.title, this.subtitle, this.actions = const [], this.bottom, this.back = false});

  final String title;
  final String? subtitle;
  final List<Widget> actions;
  final Widget? bottom;

  /// A back button before the title (pages opened from another).
  final bool back;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppPalette.navy700, AppPalette.navy, Color(0xFF0B1727)],
          ),
        ),
        child: Stack(children: [
          const Positioned.fill(child: CustomPaint(painter: _HeroPainter())),
          Padding(
            padding: EdgeInsets.fromLTRB(16, top + 10, 16, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              Row(children: [
                if (back) ...[
                  // arrow_back mirrors itself to → in Arabic.
                  HomeHeroButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).maybePop()),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(22, Colors.white)),
                    if ((subtitle ?? '').isNotEmpty)
                      Text(subtitle!, style: const TextStyle(color: AppPalette.gold200, fontSize: 12, fontWeight: FontWeight.w600)),
                  ]),
                ),
                for (final a in actions) ...[const SizedBox(width: 8), a],
              ]),
              if (bottom != null) ...[const SizedBox(height: 14), bottom!],
            ]),
          ),
        ]),
      ),
    );
  }
}

/// A round glass button on the navy header; gold when [active].
class HomeHeroButton extends StatelessWidget {
  const HomeHeroButton({super.key, required this.icon, required this.onTap, this.active = false, this.tooltip, this.dot = false});
  final IconData icon;
  final VoidCallback onTap;
  final bool active;
  final String? tooltip;

  /// A gold dot: something is filtered.
  final bool dot;

  @override
  Widget build(BuildContext context) {
    final button = Material(
      color: active ? AppPalette.gold400 : Colors.white.withValues(alpha: 0.10),
      shape: CircleBorder(side: BorderSide(color: Colors.white.withValues(alpha: active ? 0 : 0.16))),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Stack(alignment: Alignment.center, children: [
            Icon(icon, size: 20, color: active ? AppPalette.navy : Colors.white),
            if (dot)
              const PositionedDirectional(
                top: 8,
                end: 8,
                child: SizedBox(width: 8, height: 8, child: DecoratedBox(decoration: BoxDecoration(color: AppPalette.gold300, shape: BoxShape.circle))),
              ),
          ]),
        ),
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}

/// The white search field on the navy header.
class HomeSearchField extends StatelessWidget {
  const HomeSearchField({super.key, required this.controller, required this.hint, required this.onSubmitted, this.onClear});
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onSubmitted;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) => Container(
        height: 46,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
        child: Row(children: [
          const SizedBox(width: 12),
          const Icon(Icons.search_rounded, size: 20, color: AppPalette.navy),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: controller,
              textInputAction: TextInputAction.search,
              onSubmitted: onSubmitted,
              style: const TextStyle(fontSize: 14, color: AppPalette.navy),
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: const TextStyle(fontSize: 13.5, color: Color(0xFF8A94A6)),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                isDense: true,
              ),
            ),
          ),
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (_, v, _) => v.text.isEmpty || onClear == null
                ? const SizedBox(width: 12)
                : IconButton(icon: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF8A94A6)), onPressed: onClear),
          ),
        ]),
      );
}

/// A row of filter pills; the chosen one navy with gold text.
class HomePills extends StatelessWidget {
  const HomePills({super.key, required this.pills, this.padding = const EdgeInsets.symmetric(horizontal: AppSpacing.md)});
  final List<HomePill> pills;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return SizedBox(
      height: 38,
      child: ListView.separated(
        padding: padding,
        scrollDirection: Axis.horizontal,
        itemCount: pills.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final p = pills[i];
          return Material(
            color: p.selected ? AppPalette.navy : colors.surface,
            shape: StadiumBorder(side: BorderSide(color: p.selected ? AppPalette.navy : colors.hairline)),
            child: InkWell(
              key: Key('home-pill-${p.id}'),
              customBorder: const StadiumBorder(),
              onTap: p.onTap,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  if (p.dot != null) ...[
                    Container(width: 7, height: 7, decoration: BoxDecoration(color: p.dot, shape: BoxShape.circle)),
                    const SizedBox(width: 6),
                  ],
                  Text(p.label,
                      style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: p.selected ? Colors.white : colors.inkStrong)),
                  if (p.count != null) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                      decoration: BoxDecoration(
                        color: p.selected ? AppPalette.gold400 : colors.surfaceSoft,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(ltr('${p.count}'),
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: p.selected ? AppPalette.navy : colors.inkMuted)),
                    ),
                  ],
                ]),
              ),
            ),
          );
        },
      ),
    );
  }
}

class HomePill {
  const HomePill({required this.id, required this.label, required this.selected, required this.onTap, this.count, this.dot});
  final String id;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? count;
  final Color? dot;
}

class _LogoInitials extends StatelessWidget {
  const _LogoInitials(this.name);
  final String? name;

  @override
  Widget build(BuildContext context) => Text(homeInitials(name), style: homeDisplay(13, AppPalette.navy));
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
          gradient: gold ? homeGoldGradient : null,
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
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: gold ? AppPalette.navy : const Color(0xFFDCE3EC))),
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
    grid.shader = LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [AppPalette.gold300.withValues(alpha: 0.06), Colors.transparent],
    ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    for (double x = 0; x < size.width; x += 26) {
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

// ── The card over the hero: a gold ring and a headline figure ────────────────

class HomeGoalCard extends StatelessWidget {
  const HomeGoalCard({
    super.key,
    required this.percent,
    required this.percentLabel,
    required this.icon,
    required this.title,
    required this.value,
    this.unit = '',
    this.trailing = '',
    this.minis = const [],
    this.emptyText,
  });

  /// The ring's percent; null with [emptyText] draws the empty card.
  final int? percent;
  final String percentLabel;
  final IconData icon;
  final String title;
  final String value;
  final String unit;

  /// Small text after the figure ("من 8 مليون ج.م").
  final String trailing;

  /// Up to two small boxes under the figure: (label, value).
  final List<(String, String)> minis;
  final String? emptyText;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      key: const Key('home-goal'),
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0xFFEFE6D4)),
        boxShadow: [BoxShadow(color: AppPalette.navy.withValues(alpha: 0.16), blurRadius: 40, offset: const Offset(0, 18))],
      ),
      child: percent == null && emptyText != null
          ? Row(children: [
              Icon(icon, color: AppPalette.gold500),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: Text(emptyText!, style: TextStyle(color: colors.inkMuted))),
            ])
          : Row(
              children: [
                SizedBox(
                  width: 92,
                  height: 92,
                  child: CustomPaint(
                    painter: _RingPainter((percent ?? 0) / 100, track: colors.surfaceSoft),
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(ltr('${percent ?? 0}%'), style: homeDisplay(24, colors.inkStrong)),
                          Text(percentLabel, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
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
                        Icon(icon, size: 15, color: AppPalette.gold500),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                        ),
                      ]),
                      const SizedBox(height: 2),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: AlignmentDirectional.centerStart,
                        child: Text.rich(TextSpan(children: [
                          TextSpan(text: unit.isEmpty ? ltr(value) : '${ltr(value)} $unit', style: homeDisplay(26, colors.inkStrong)),
                          if (trailing.isNotEmpty)
                            TextSpan(text: '  $trailing', style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
                        ])),
                      ),
                      if (minis.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Row(children: [
                          for (var i = 0; i < minis.length; i++) ...[
                            if (i > 0) const SizedBox(width: 6),
                            Expanded(child: _MiniStat(label: minis[i].$1, value: minis[i].$2)),
                          ],
                        ]),
                      ],
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
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
            Text(value, maxLines: 1, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppPalette.navy)),
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

// ── Round actions ────────────────────────────────────────────────────────────

class HomeAction {
  const HomeAction({required this.id, required this.icon, required this.label, required this.onTap});
  final String id;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
}

/// Four round actions; the first is gold (the main one).
class HomeActions extends StatelessWidget {
  const HomeActions({super.key, required this.actions});
  final List<HomeAction> actions;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.lg, AppSpacing.md, 0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < actions.length; i++)
              Expanded(
                child: InkWell(
                  key: Key('home-action-${actions[i].id}'),
                  borderRadius: BorderRadius.circular(20),
                  onTap: actions[i].onTap,
                  child: Column(
                    children: [
                      Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                          gradient: i == 0 ? homeGoldGradient : homeNavyGradient,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: (i == 0 ? AppPalette.gold500 : AppPalette.navy).withValues(alpha: i == 0 ? 0.32 : 0.22),
                              blurRadius: 20,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: Icon(actions[i].icon, size: 24, color: i == 0 ? AppPalette.navy : AppPalette.gold300),
                      ),
                      const SizedBox(height: 7),
                      Text(actions[i].label,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: context.appColors.inkStrong)),
                    ],
                  ),
                ),
              ),
          ],
        ),
      );
}

// ── Section ──────────────────────────────────────────────────────────────────

class HomeSection extends StatelessWidget {
  const HomeSection({super.key, required this.icon, required this.title, required this.child, this.action, this.onAction});
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
                Expanded(child: Text(title, style: homeDisplay(18.5, context.appColors.inkStrong))),
                if (action != null)
                  InkWell(
                    onTap: onAction,
                    child: Row(children: [
                      Text(action!, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppPalette.gold600)),
                      // chevron_right mirrors to the outward arrow in Arabic.
                      const Icon(Icons.chevron_right_rounded, size: 18, color: AppPalette.gold600),
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

// ── Figures ──────────────────────────────────────────────────────────────────

class HomeFigure {
  const HomeFigure({required this.id, required this.value, required this.label, required this.hint, this.warn = false});
  final String id;
  final String value;
  final String label;
  final String hint;
  final bool warn;
}

/// Three headline figures on a navy band.
class HomeBand extends StatelessWidget {
  const HomeBand({super.key, required this.figures});
  final List<HomeFigure> figures;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
        decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(24)),
        child: Row(
          children: [
            for (var i = 0; i < figures.length; i++) ...[
              if (i > 0) Container(width: 1, height: 60, color: Colors.white.withValues(alpha: 0.10)),
              Expanded(
                child: Column(
                  key: Key('home-fig-${figures[i].id}'),
                  children: [
                    FittedBox(fit: BoxFit.scaleDown, child: Text(ltr(figures[i].value), style: homeDisplay(28, Colors.white))),
                    const SizedBox(height: 2),
                    Text(figures[i].label,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: Color(0xFFC9D2DE))),
                    const SizedBox(height: 5),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: figures[i].warn ? AppPalette.warningLight.withValues(alpha: 0.22) : Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(figures[i].hint,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, color: figures[i].warn ? const Color(0xFFF2C77E) : const Color(0xFFDCE3EC))),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      );
}

class HomeTile {
  const HomeTile({required this.label, required this.value, this.unit = '', this.sub = ''});
  final String label;
  final String value;
  final String unit;
  final String sub;
}

/// Three light tiles under the band.
class HomeTiles extends StatelessWidget {
  const HomeTiles({super.key, required this.tiles});
  final List<HomeTile> tiles;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < tiles.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(11),
                  decoration: homeCard(context, radius: 18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(tiles[i].label, maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
                      const SizedBox(height: 3),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: AlignmentDirectional.centerStart,
                        child: Text.rich(TextSpan(children: [
                          TextSpan(text: ltr(tiles[i].value), style: homeDisplay(21, context.appColors.inkStrong)),
                          if (tiles[i].unit.isNotEmpty)
                            TextSpan(text: ' ${tiles[i].unit}', style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
                        ])),
                      ),
                      Text(tiles[i].sub, maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      );
}

// ── Attention cards ──────────────────────────────────────────────────────────

enum HomeTone { amber, rose, sky, gold }

class HomeAttention {
  const HomeAttention({
    required this.id,
    required this.icon,
    required this.tone,
    required this.count,
    required this.label,
    required this.onTap,
    this.hot = false,
  });
  final String id;
  final IconData icon;
  final HomeTone tone;
  final int count;
  final String label;
  final VoidCallback onTap;

  /// The one that needs acting on now: warm gold, when its count is above 0.
  final bool hot;
}

class HomeAttentionGrid extends StatelessWidget {
  const HomeAttentionGrid({super.key, required this.cards, this.columns = 3});
  final List<HomeAttention> cards;
  final int columns;

  static (Color, Color) _tone(HomeTone t) => switch (t) {
        HomeTone.amber => (AppPalette.warningLight, const Color(0xFFFBF1DF)),
        HomeTone.rose => (AppPalette.errorLight, const Color(0xFFF8E6E4)),
        HomeTone.sky => (const Color(0xFF2F6FA8), const Color(0xFFE6EFF7)),
        HomeTone.gold => (AppPalette.gold500, AppPalette.gold50),
      };

  @override
  Widget build(BuildContext context) {
    Widget card(HomeAttention a) {
      final hot = a.hot && a.count > 0;
      final (fg, bg) = _tone(a.tone);
      return InkWell(
        key: Key('home-att-${a.id}'),
        borderRadius: BorderRadius.circular(20),
        onTap: a.onTap,
        child: Container(
          constraints: BoxConstraints(minHeight: columns == 3 ? 128 : 112),
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
              : homeCard(context),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(color: hot ? AppPalette.warningLight : bg, borderRadius: BorderRadius.circular(11)),
                  child: Icon(a.icon, size: 18, color: hot ? Colors.white : fg),
                ),
                const Spacer(),
                Icon(Icons.chevron_right_rounded, size: 18, color: context.appColors.inkMuted.withValues(alpha: 0.6)),
              ]),
              const SizedBox(height: 8),
              Text(ltr('${a.count}'), style: homeDisplay(26, hot ? const Color(0xFF8A5A12) : context.appColors.inkStrong)),
              const SizedBox(height: 4),
              Text(a.label, style: TextStyle(fontSize: 12, height: 1.35, color: context.appColors.inkMuted)),
            ],
          ),
        ),
      );
    }

    final rows = <Widget>[];
    for (var i = 0; i < cards.length; i += columns) {
      final slice = cards.sublist(i, math.min(i + columns, cards.length));
      rows.add(Padding(
        padding: EdgeInsets.only(top: i == 0 ? 0 : 8),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var j = 0; j < columns; j++) ...[
                if (j > 0) const SizedBox(width: 8),
                Expanded(child: j < slice.length ? card(slice[j]) : const SizedBox.shrink()),
              ],
            ],
          ),
        ),
      ));
    }
    return Column(children: rows);
  }
}

// ── Ranked list (team, top sellers, brokers) ─────────────────────────────────

class HomeRankRow {
  const HomeRankRow({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.value,
    this.unit = '',
    this.percent,
    this.icon,
    this.onTap,
  });
  final String id;
  final String title;
  final String subtitle;
  final String value;
  final String unit;

  /// A thin gold bar under the title (share of target).
  final int? percent;

  /// An icon instead of the initials (a broker firm).
  final IconData? icon;
  final VoidCallback? onTap;
}

class HomeRankList extends StatelessWidget {
  const HomeRankList({super.key, required this.rows, this.ranked = true, this.empty});
  final List<HomeRankRow> rows;
  final bool ranked;
  final String? empty;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    if (rows.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: homeCard(context, radius: 24),
        child: Text(empty ?? '', style: TextStyle(color: colors.inkMuted, fontSize: 13)),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: homeCard(context, radius: 24),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++)
            InkWell(
              key: Key('home-rank-${rows[i].id}'),
              onTap: rows[i].onTap,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 11),
                decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: colors.hairline))),
                child: Row(
                  children: [
                    if (ranked) ...[
                      Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          gradient: i == 0 ? homeGoldGradient : null,
                          color: i == 0 ? null : colors.surfaceSoft,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        alignment: Alignment.center,
                        child: Text(ltr('${i + 1}'),
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: i == 0 ? AppPalette.navy : colors.inkMuted)),
                      ),
                      const SizedBox(width: 11),
                    ],
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(14)),
                      alignment: Alignment.center,
                      child: rows[i].icon != null
                          ? Icon(rows[i].icon, size: 18, color: AppPalette.gold300)
                          : Text(homeInitials(rows[i].title), style: homeDisplay(13, AppPalette.gold300)),
                    ),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(rows[i].title, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                          Text(rows[i].subtitle, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                          if (rows[i].percent != null) ...[
                            const SizedBox(height: 6),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: SizedBox(
                                height: 6,
                                child: Stack(children: [
                                  Container(color: colors.surfaceSoft),
                                  FractionallySizedBox(
                                    alignment: AlignmentDirectional.centerStart,
                                    widthFactor: (rows[i].percent! / 100).clamp(0.0, 1.0),
                                    child: Container(
                                      decoration: const BoxDecoration(
                                        gradient: LinearGradient(colors: [AppPalette.gold200, AppPalette.gold500]),
                                      ),
                                    ),
                                  ),
                                ]),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(ltr(rows[i].value), style: homeDisplay(16, colors.inkStrong)),
                        if (rows[i].unit.isNotEmpty)
                          Text(rows[i].unit, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Funnel ───────────────────────────────────────────────────────────────────

class HomeFunnelStep {
  const HomeFunnelStep({required this.label, required this.value, required this.colors});
  final String label;
  final int value;
  final List<Color> colors;
}

const homeTaupe = [Color(0xFF8A7F70), Color(0xFF6B6256)];
const homeNavy = [AppPalette.navy600, AppPalette.navy];
const homeGold = [AppPalette.gold300, AppPalette.gold500];
const homeAmber = [Color(0xFFDDA14A), AppPalette.warningLight];
const homeGreen = [Color(0xFF5C9A78), AppPalette.successLight];

/// Steps as bars, each with its conversion from the step before.
class HomeFunnel extends StatelessWidget {
  const HomeFunnel({super.key, required this.steps, this.rates = true});
  final List<HomeFunnelStep> steps;
  final bool rates;

  @override
  Widget build(BuildContext context) {
    final max = steps.map((s) => s.value).fold<int>(1, (m, v) => v > m ? v : m);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 9, 14, 9),
      decoration: homeCard(context, radius: 24),
      child: Column(
        children: [
          for (var i = 0; i < steps.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4.5),
              child: Row(children: [
                Expanded(
                  child: Container(
                    height: 34,
                    decoration: BoxDecoration(color: context.appColors.surfaceSoft, borderRadius: BorderRadius.circular(11)),
                    child: FractionallySizedBox(
                      key: Key('home-funnel-$i'),
                      alignment: AlignmentDirectional.centerStart,
                      widthFactor: (steps[i].value / max).clamp(0.3, 1.0),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 11),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: steps[i].colors),
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: Row(children: [
                          Expanded(
                            child: Text(steps[i].label, maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                          ),
                          Text(ltr('${steps[i].value}'), style: homeDisplay(16, Colors.white)),
                        ]),
                      ),
                    ),
                  ),
                ),
                if (rates)
                  SizedBox(
                    width: 46,
                    child: Text(
                      i == 0 ? '' : ltr('${homePercent(steps[i].value, steps[i - 1].value) ?? 0}%'),
                      textAlign: TextAlign.end,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppPalette.gold600),
                    ),
                  ),
              ]),
            ),
        ],
      ),
    );
  }
}

// ── Bars ─────────────────────────────────────────────────────────────────────

/// Monthly bars; the highest one in gold.
class HomeBars extends StatelessWidget {
  const HomeBars({super.key, required this.bars});
  final List<(String, int)> bars;

  @override
  Widget build(BuildContext context) {
    final max = bars.map((b) => b.$2).fold<int>(1, (m, v) => v > m ? v : m);
    return Container(
      height: 180,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
      decoration: homeCard(context, radius: 24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < bars.length; i++) ...[
            if (i > 0) const SizedBox(width: 10),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(ltr('${bars[i].$2}'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: context.appColors.inkStrong)),
                  const SizedBox(height: 4),
                  Container(
                    height: 8 + 100 * bars[i].$2 / max,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: bars[i].$2 == max ? homeGold : homeNavy,
                      ),
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(10), bottom: Radius.circular(4)),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(bars[i].$1, maxLines: 1, overflow: TextOverflow.clip,
                      style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Activity ─────────────────────────────────────────────────────────────────

class HomeActivityItem {
  const HomeActivityItem({required this.icon, required this.title, required this.subtitle, required this.when});
  final IconData icon;
  final String title;
  final String subtitle;
  final String when;
}

class HomeActivityList extends StatelessWidget {
  const HomeActivityList({super.key, required this.items, this.empty});
  final List<HomeActivityItem> items;
  final String? empty;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: homeCard(context, radius: 24),
      child: items.isEmpty
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(empty ?? '', style: TextStyle(color: colors.inkMuted, fontSize: 13)),
            )
          : Column(
              children: [
                for (var i = 0; i < items.length; i++)
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: colors.hairline))),
                    child: Row(children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(color: AppPalette.gold50, borderRadius: BorderRadius.circular(11)),
                        child: Icon(items[i].icon, size: 18, color: AppPalette.gold500),
                      ),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(items[i].title, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                          if (items[i].subtitle.isNotEmpty)
                            Text(items[i].subtitle, maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                        ]),
                      ),
                      const SizedBox(width: 8),
                      Text(items[i].when, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    ]),
                  ),
              ],
            ),
    );
  }
}

/// The signed-in person's name, for the hero.
String homeSessionName(BuildContext context) =>
    (context.read<SessionCubit>().state.sessionOrNull?.displayName ?? '').trim();

/// [bottom] laid over the last [overlap] pixels of [top] (a card over a
/// hero's edge). Unlike a `Transform.translate`, the card is really there:
/// it takes taps where it is drawn and leaves no gap under it.
class HomeOverlap extends MultiChildRenderObjectWidget {
  HomeOverlap({super.key, required Widget top, required Widget bottom, required this.overlap}) : super(children: [top, bottom]);

  final double overlap;

  @override
  RenderObject createRenderObject(BuildContext context) => RenderHomeOverlap(overlap);

  @override
  void updateRenderObject(BuildContext context, RenderHomeOverlap renderObject) => renderObject.overlap = overlap;
}

class _HomeOverlapData extends ContainerBoxParentData<RenderBox> {}

class RenderHomeOverlap extends RenderBox
    with ContainerRenderObjectMixin<RenderBox, _HomeOverlapData>, RenderBoxContainerDefaultsMixin<RenderBox, _HomeOverlapData> {
  RenderHomeOverlap(this._overlap);

  double _overlap;
  set overlap(double v) {
    if (v == _overlap) return;
    _overlap = v;
    markNeedsLayout();
  }

  @override
  void setupParentData(RenderBox child) {
    if (child.parentData is! _HomeOverlapData) child.parentData = _HomeOverlapData();
  }

  @override
  void performLayout() {
    final c = BoxConstraints.tightFor(width: constraints.maxWidth);
    final top = firstChild!;
    final bottom = childAfter(top)!;
    top.layout(c, parentUsesSize: true);
    bottom.layout(c, parentUsesSize: true);
    (top.parentData! as _HomeOverlapData).offset = Offset.zero;
    final y = math.max(0.0, top.size.height - _overlap);
    (bottom.parentData! as _HomeOverlapData).offset = Offset(0, y);
    size = constraints.constrain(Size(constraints.maxWidth, math.max(top.size.height, y + bottom.size.height)));
  }

  @override
  void paint(PaintingContext context, Offset offset) => defaultPaint(context, offset);

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) => defaultHitTestChildren(result, position: position);
}
