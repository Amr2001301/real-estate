import 'package:flutter/material.dart';

import '../../core.dart';

/// The staff app's Devora pieces: one dark figure card per page, white list
/// cards with hairlines, rows with a title and a sub-line that breathe, gold
/// primary actions. Status colours only where they mean something.

const dvGoldGradient = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [Color(0xFFE9CF8E), Color(0xFFD2AE58), Color(0xFFB88F35)],
);
const dvOnGold = Color(0xFF1B1405);

/// Page title block: a small line over a large title, with trailing buttons.
class DvPageTitle extends StatelessWidget {
  const DvPageTitle({super.key, required this.title, this.overline, this.trailing = const []});
  final String title;
  final String? overline;
  final List<Widget> trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, MediaQuery.paddingOf(context).top + 14, 20, 0),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (overline != null) ...[
              Text(overline!, style: TextStyle(fontSize: 13, height: 1.4, color: colors.inkMuted)),
              const SizedBox(height: 4),
            ],
            Text(title, style: TextStyle(fontSize: 24, height: 1.3, fontWeight: FontWeight.w700, color: colors.inkStrong)),
          ]),
        ),
        for (final t in trailing) ...[const SizedBox(width: 10), t],
      ]),
    );
  }
}

/// A square white button with a hairline (bell, filter…), with an optional dot.
class DvIconButton extends StatelessWidget {
  const DvIconButton({super.key, required this.icon, required this.onTap, this.dot = false, this.tooltip});
  final IconData icon;
  final VoidCallback onTap;
  final bool dot;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Tooltip(
      message: tooltip ?? '',
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: colors.hairline)),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Stack(alignment: Alignment.center, children: [
              Icon(icon, size: 21, color: colors.inkStrong),
              if (dot)
                PositionedDirectional(
                  top: 10,
                  end: 11,
                  child: Container(width: 8, height: 8, decoration: BoxDecoration(color: colors.error, shape: BoxShape.circle)),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// The page's one dark card: a label, a large figure with its unit, a side
/// figure, a gold progress line and a footer of short facts.
class DvHeroCard extends StatelessWidget {
  const DvHeroCard({
    super.key,
    required this.label,
    required this.value,
    this.unit = '',
    this.sideLabel,
    this.sideValue,
    this.progress,
    this.facts = const [],
  });
  final String label;
  final String value;
  final String unit;
  final String? sideLabel;
  final String? sideValue;

  /// 0..1, or null for no line.
  final double? progress;
  final List<String> facts;

  @override
  Widget build(BuildContext context) {
    const muted = Color(0xFFAEB8CB);
    return Container(
      key: const Key('dv-hero'),
      margin: const EdgeInsets.fromLTRB(20, 18, 20, 0),
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [Color(0xFF17223B), Color(0xFF0B1426), Color(0xFF070C17)]),
        boxShadow: [BoxShadow(color: const Color(0xFF0B1426).withValues(alpha: 0.22), blurRadius: 26, offset: const Offset(0, 12))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(fontSize: 13, height: 1.4, color: muted)),
              const SizedBox(height: 6),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: AlignmentDirectional.centerStart,
                child: Text.rich(TextSpan(children: [
                  TextSpan(text: ltr(value), style: const TextStyle(fontSize: 38, height: 1.1, fontWeight: FontWeight.w700, color: Colors.white)),
                  if (unit.isNotEmpty) TextSpan(text: '  $unit', style: const TextStyle(fontSize: 13.5, color: muted)),
                ])),
              ),
            ]),
          ),
          if (sideValue != null)
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              if (sideLabel != null) Text(sideLabel!, style: const TextStyle(fontSize: 12.5, height: 1.4, color: muted)),
              const SizedBox(height: 4),
              Text(ltr(sideValue!), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
            ]),
        ]),
        if (progress != null) ...[
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Stack(children: [
              Container(height: 6, color: Colors.white.withValues(alpha: 0.12)),
              FractionallySizedBox(
                widthFactor: progress!.clamp(0.0, 1.0),
                child: Container(
                  height: 6,
                  decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFFB88F35), Color(0xFFEED7A0)])),
                ),
              ),
            ]),
          ),
        ],
        if (facts.isNotEmpty) ...[
          const SizedBox(height: 14),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Row(children: [
              for (var i = 0; i < facts.length; i++) ...[
                if (i > 0) const Padding(padding: EdgeInsets.symmetric(horizontal: 9), child: Text('·', style: TextStyle(color: Color(0xFF6F7B93)))),
                Text(facts[i], style: const TextStyle(fontSize: 12.5, height: 1.4, color: Color(0xFFC9D1DF))),
              ],
            ]),
          ),
        ],
      ]),
    );
  }
}

/// A section heading with an optional trailing link.
class DvSectionTitle extends StatelessWidget {
  const DvSectionTitle({super.key, required this.title, this.trailing, this.onTrailing});
  final String title;
  final String? trailing;
  final VoidCallback? onTrailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 26, 20, 10),
      child: Row(children: [
        Expanded(child: Text(title, style: TextStyle(fontSize: 16.5, height: 1.3, fontWeight: FontWeight.w700, color: colors.inkStrong))),
        if (trailing != null)
          GestureDetector(
            onTap: onTrailing,
            child: Text(trailing!, style: TextStyle(fontSize: 13, color: colors.inkMuted, fontWeight: FontWeight.w600)),
          ),
      ]),
    );
  }
}

/// White card holding rows separated by hairlines.
class DvListCard extends StatelessWidget {
  const DvListCard({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline),
        boxShadow: Theme.of(context).brightness == Brightness.dark
            ? null
            : [BoxShadow(color: const Color(0xFF0B1426).withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) Divider(height: 1, thickness: 1, indent: 16, endIndent: 16, color: colors.hairline),
          children[i],
        ],
      ]),
    );
  }
}

enum DvTone { neutral, warn, bad, ok }

/// A count or status in a soft pill.
class DvPill extends StatelessWidget {
  const DvPill(this.text, {super.key, this.tone = DvTone.neutral});
  final String text;
  final DvTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final (fg, bg) = switch (tone) {
      DvTone.warn => (dark ? const Color(0xFFF0C27E) : const Color(0xFF9A5B0C), dark ? const Color(0x26E6A03C) : const Color(0xFFFBF1E1)),
      DvTone.bad => (dark ? const Color(0xFFF29AA2) : const Color(0xFFB3303D), dark ? const Color(0x26E65A64) : const Color(0xFFFBE9EA)),
      DvTone.ok => (dark ? const Color(0xFF7FD8B2) : const Color(0xFF1E7A55), dark ? const Color(0x2446BE8C) : const Color(0xFFE7F4EE)),
      DvTone.neutral => (colors.inkMuted, colors.surfaceSoft),
    };
    return Container(
      constraints: const BoxConstraints(minWidth: 28),
      height: 28,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
      child: Text(ltr(text), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: fg)),
    );
  }
}

/// A list row: an icon tile, a title and a sub-line with room between them,
/// a trailing widget and a chevron.
class DvRow extends StatelessWidget {
  const DvRow({super.key, this.icon, this.leading, required this.title, this.subtitle, this.trailing, this.onTap, this.chevron = true});
  final IconData? icon;
  final Widget? leading;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool chevron;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        child: Row(children: [
          if (leading != null)
            leading!
          else if (icon != null)
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, size: 20, color: colors.inkStrong),
            ),
          if (leading != null || icon != null) const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, height: 1.4, fontWeight: FontWeight.w600, color: colors.inkStrong)),
              if (subtitle != null) ...[
                const SizedBox(height: 5),
                Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, height: 1.4, color: colors.inkMuted)),
              ],
            ]),
          ),
          if (trailing != null) ...[const SizedBox(width: 10), trailing!],
          if (chevron && onTap != null) ...[const SizedBox(width: 6), Icon(AppIcons.chevronForward, size: 18, color: colors.inkMuted.withValues(alpha: 0.7))],
        ]),
      ),
    );
  }
}

/// The gold primary action.
class DvGoldButton extends StatelessWidget {
  const DvGoldButton({super.key, required this.label, required this.onTap, this.icon, this.height = 48});
  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final double height;

  @override
  Widget build(BuildContext context) => Opacity(
        opacity: onTap == null ? 0.5 : 1,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: dvGoldGradient,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [BoxShadow(color: const Color(0xFFB88F35).withValues(alpha: 0.4), blurRadius: 16, offset: const Offset(0, 7))],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: onTap,
              child: SizedBox(
                height: height,
                child: Row(mainAxisAlignment: MainAxisAlignment.center, mainAxisSize: MainAxisSize.min, children: [
                  if (icon != null) ...[Icon(icon, size: 19, color: dvOnGold), const SizedBox(width: 8)],
                  Text(label, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: dvOnGold)),
                ]),
              ),
            ),
          ),
        ),
      );
}

/// The list card of the staff app (the leads' design A): a navy circle with
/// gold initials (or an icon), the title and one line under it, the status;
/// a hairline; then the one fact that matters now (coloured when it needs
/// attention) with a line under it, and up to two actions, the main one gold.
class DvEntityCard extends StatelessWidget {
  const DvEntityCard({
    super.key,
    required this.title,
    this.initials,
    this.icon,
    this.subtitle,
    this.status,
    this.statusColor,
    this.footIcon,
    this.footText,
    this.footColor,
    this.footSub,
    this.footKey,
    this.actions = const [],
    this.onTap,
    this.inkKey,
  });
  final String title;
  final String? initials;
  final IconData? icon;
  final String? subtitle;
  final String? status;
  final Color? statusColor;
  final IconData? footIcon;
  final String? footText;
  final Color? footColor;
  final String? footSub;
  final Key? footKey;
  final List<Widget> actions;
  final VoidCallback? onTap;
  final Key? inkKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final sc = statusColor ?? colors.inkMuted;
    final hasFoot = footText != null || actions.isNotEmpty;
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        key: inkKey,
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: colors.hairline),
            boxShadow: Theme.of(context).brightness == Brightness.dark
                ? null
                : [BoxShadow(color: const Color(0xFF0B1426).withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, 8))],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: Color(0xFF0B1426), shape: BoxShape.circle),
                child: initials != null
                    ? Text(initials!, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFFEED7A0)))
                    : Icon(icon ?? Icons.circle_outlined, size: 20, color: const Color(0xFFEED7A0)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, height: 1.4, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                  if ((subtitle ?? '').isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, height: 1.4, color: colors.inkMuted)),
                  ],
                ]),
              ),
              if (status != null) ...[
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(color: sc.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                  child: Text(status!, style: TextStyle(fontSize: 12, height: 1.4, fontWeight: FontWeight.w700, color: sc)),
                ),
              ],
            ]),
            if (hasFoot) ...[
              Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: colors.hairline)),
              Row(children: [
                if (footIcon != null) ...[Icon(footIcon, size: 19, color: footColor ?? colors.inkMuted), const SizedBox(width: 10)],
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (footText != null)
                      Text(footText!,
                          key: footKey,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 13, height: 1.4, fontWeight: FontWeight.w600, color: footColor ?? colors.inkStrong)),
                    if ((footSub ?? '').isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(footSub!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, height: 1.4, color: colors.inkMuted)),
                    ],
                  ]),
                ),
                for (final a in actions) ...[const SizedBox(width: 8), a],
              ]),
            ],
          ]),
        ),
      ),
    );
  }
}

/// A 40px rounded-square action: soft grey, or gold for the main one.
class DvSquareAction extends StatelessWidget {
  const DvSquareAction({super.key, required this.icon, required this.onTap, this.color, this.gold = false, this.tooltip, this.busy = false});
  final IconData icon;
  final VoidCallback? onTap;
  final Color? color;
  final bool gold;
  final String? tooltip;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final w = DecoratedBox(
      decoration: BoxDecoration(gradient: gold ? dvGoldGradient : null, color: gold ? null : colors.surfaceSoft, borderRadius: BorderRadius.circular(13)),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(13),
          onTap: busy ? null : onTap,
          child: SizedBox(
            width: 40,
            height: 40,
            child: busy
                ? const Padding(padding: EdgeInsets.all(11), child: CircularProgressIndicator(strokeWidth: 2))
                : Icon(icon, size: 19, color: gold ? dvOnGold : (color ?? colors.inkStrong)),
          ),
        ),
      ),
    );
    return tooltip == null ? w : Tooltip(message: tooltip!, child: w);
  }
}

/// One figure of a [DvStatsCard].
class DvStat {
  const DvStat({required this.label, required this.value, this.unit = '', this.hint, this.warn = false, this.id});
  final String label;
  final String value;
  final String unit;
  final String? hint;
  final bool warn;
  final String? id;
}

/// A report's figures in one white card: two per row, hairlines between,
/// the label small, the figure large, a short hint under it.
class DvStatsCard extends StatelessWidget {
  const DvStatsCard({super.key, required this.stats});
  final List<DvStat> stats;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    Widget cell(DvStat s) => Padding(
          key: s.id == null ? null : Key('dv-stat-${s.id}'),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(s.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, height: 1.4, color: colors.inkMuted)),
            const SizedBox(height: 6),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: AlignmentDirectional.centerStart,
              child: Text.rich(TextSpan(children: [
                TextSpan(text: ltr(s.value), style: TextStyle(fontSize: 24, height: 1.15, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                if (s.unit.isNotEmpty) TextSpan(text: '  ${s.unit}', style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
              ])),
            ),
            if ((s.hint ?? '').isNotEmpty) ...[
              const SizedBox(height: 5),
              Text(s.hint!, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, height: 1.4, fontWeight: s.warn ? FontWeight.w600 : FontWeight.w400, color: s.warn ? colors.warning : colors.inkMuted)),
            ],
          ]),
        );
    final rows = <Widget>[];
    for (var i = 0; i < stats.length; i += 2) {
      if (i > 0) rows.add(Divider(height: 1, thickness: 1, color: colors.hairline));
      rows.add(IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Expanded(child: cell(stats[i])),
          VerticalDivider(width: 1, thickness: 1, color: colors.hairline),
          Expanded(child: i + 1 < stats.length ? cell(stats[i + 1]) : const SizedBox()),
        ]),
      ));
    }
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline),
        boxShadow: Theme.of(context).brightness == Brightness.dark
            ? null
            : [BoxShadow(color: const Color(0xFF0B1426).withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: rows),
    );
  }
}

/// A report's headline in a navy card: the main figure large with its change,
/// a gold curve of the year so far, then up to four small figures in a row.
class DvHeroStats extends StatelessWidget {
  const DvHeroStats({
    super.key,
    required this.label,
    required this.value,
    this.unit = '',
    this.change,
    this.note,
    this.curve = const [],
    this.curveLabel,
    this.figures = const [],
  });

  final String label;
  final String value;
  final String unit;

  /// Percent change against the previous period; null hides the pill.
  final int? change;

  /// A short line under the figure when there is no change to show.
  final String? note;
  final List<num> curve;
  final String? curveLabel;
  final List<DvStat> figures;

  static const _muted = Color(0xFF9AA4B4);

  @override
  Widget build(BuildContext context) {
    final up = (change ?? 0) >= 0;
    return Container(
      key: const Key('dv-hero-stats'),
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF17233D), Color(0xFF080E1A)]),
        borderRadius: BorderRadius.circular(26),
        boxShadow: const [BoxShadow(color: Color(0x290B1426), blurRadius: 24, offset: Offset(0, 10))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(label, style: const TextStyle(fontSize: 13, color: _muted)),
        const SizedBox(height: 6),
        Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          Expanded(
            child: FittedBox(
              key: const Key('dv-stat-sales'),
              fit: BoxFit.scaleDown,
              alignment: AlignmentDirectional.centerStart,
              child: Text.rich(TextSpan(children: [
                TextSpan(text: ltr(value), style: const TextStyle(fontSize: 38, height: 1.1, fontWeight: FontWeight.w800, color: Colors.white)),
                if (unit.isNotEmpty) TextSpan(text: '  $unit', style: const TextStyle(fontSize: 13, color: _muted)),
              ])),
            ),
          ),
          if (change != null)
            Container(
              key: const Key('dv-hero-change'),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: up ? const Color(0xFFDDF3E6) : const Color(0xFFFBE3E3),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(ltr('${up ? '▲' : '▼'} ${change!.abs()}%'),
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: up ? const Color(0xFF1E7A4C) : const Color(0xFFB3261E))),
            ),
        ]),
        if ((note ?? '').isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(note!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Color(0xFFC9B27A))),
        ],
        if (curve.length >= 2) ...[
          const SizedBox(height: 14),
          SizedBox(height: 62, child: CustomPaint(painter: _DvCurvePainter(curve))),
          if ((curveLabel ?? '').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(curveLabel!, style: const TextStyle(fontSize: 11, color: _muted)),
            ),
        ],
        if (figures.isNotEmpty) ...[
          const SizedBox(height: 14),
          const Divider(height: 1, thickness: 1, color: Color(0x1FFFFFFF)),
          const SizedBox(height: 14),
          Row(children: [
            for (final f in figures)
              Expanded(
                child: Column(key: f.id == null ? null : Key('dv-stat-${f.id}'), children: [
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text.rich(TextSpan(children: [
                      TextSpan(text: ltr(f.value), style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: Colors.white)),
                      if (f.unit.isNotEmpty) TextSpan(text: ' ${f.unit}', style: const TextStyle(fontSize: 11, color: _muted)),
                    ])),
                  ),
                  const SizedBox(height: 4),
                  Text(f.label, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 11.5, color: f.warn ? const Color(0xFFE9CF8E) : _muted)),
                ]),
              ),
          ]),
        ],
      ]),
    );
  }
}

class _DvCurvePainter extends CustomPainter {
  _DvCurvePainter(this.values);
  final List<num> values;

  @override
  void paint(Canvas canvas, Size size) {
    final hi = values.fold<num>(0, (a, v) => v > a ? v : a);
    final lo = values.fold<num>(hi, (a, v) => v < a ? v : a);
    final span = (hi - lo) == 0 ? 1 : (hi - lo);
    Offset at(int i) {
      final x = size.width * i / (values.length - 1);
      final y = size.height - 4 - (values[i] - lo) / span * (size.height - 10);
      return Offset(x, y);
    }

    final line = Path()..moveTo(at(0).dx, at(0).dy);
    for (var i = 1; i < values.length; i++) {
      final a = at(i - 1), b = at(i);
      final mx = (a.dx + b.dx) / 2;
      line.cubicTo(mx, a.dy, mx, b.dy, b.dx, b.dy);
    }
    final fill = Path.from(line)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(
      fill,
      Paint()
        ..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x55D2AE58), Color(0x00D2AE58)])
            .createShader(Offset.zero & size),
    );
    canvas.drawPath(
      line,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..shader = dvGoldGradient.createShader(Offset.zero & size),
    );
    final end = at(values.length - 1);
    canvas.drawCircle(end, 4.5, Paint()..color = const Color(0xFFE9CF8E));
  }

  @override
  bool shouldRepaint(_DvCurvePainter old) => old.values != values;
}

class DvRankRow {
  const DvRankRow({required this.id, required this.title, required this.amount, required this.value, this.unit = '', this.subtitle, this.onTap});
  final String id;
  final String title;
  final String? subtitle;

  /// The raw figure the bars compare.
  final double amount;
  final String value;
  final String unit;
  final VoidCallback? onTap;
}

/// A ranking in one white card: the rank (gold for the first), the name, the
/// figure, and a thin bar of each row against the largest, with its share of
/// [total] when one is given.
class DvRankList extends StatelessWidget {
  const DvRankList({super.key, required this.rows, this.total, this.empty});
  final List<DvRankRow> rows;
  final double? total;
  final String? empty;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    if (rows.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(18),
        decoration: homeCard(context, radius: 24),
        child: Text(empty ?? '', style: TextStyle(color: colors.inkMuted, fontSize: 13)),
      );
    }
    final max = rows.fold<double>(0, (a, r) => r.amount > a ? r.amount : a);
    final out = <Widget>[];
    for (var i = 0; i < rows.length; i++) {
      final r = rows[i];
      final first = i == 0;
      if (i > 0) out.add(Divider(height: 1, thickness: 1, indent: 16, endIndent: 16, color: colors.hairline));
      out.add(InkWell(
        key: Key('dv-rank-${r.id}'),
        onTap: r.onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Column(children: [
            Row(children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: first ? dvGoldGradient : null,
                  color: first ? null : colors.surfaceSoft,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Text(ltr('${i + 1}'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: first ? dvOnGold : colors.inkMuted)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(r.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.inkStrong)),
                  if ((r.subtitle ?? '').isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(r.subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                  ],
                ]),
              ),
              const SizedBox(width: 10),
              Text.rich(TextSpan(children: [
                TextSpan(text: ltr(r.value), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                if (r.unit.isNotEmpty) TextSpan(text: ' ${r.unit}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              ])),
            ]),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 40),
              child: Row(children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: SizedBox(
                      height: 6,
                      child: Stack(children: [
                        Positioned.fill(child: ColoredBox(color: colors.surfaceSoft)),
                        FractionallySizedBox(
                          widthFactor: max <= 0 ? 0 : (r.amount / max).clamp(0, 1).toDouble(),
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: first ? dvGoldGradient : null,
                              color: first ? null : const Color(0xFF1B2A48),
                              borderRadius: BorderRadius.circular(3),
                            ),
                            child: const SizedBox.expand(),
                          ),
                        ),
                      ]),
                    ),
                  ),
                ),
                if (total != null && total! > 0) ...[
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 38,
                    child: Text(ltr('${(r.amount / total! * 100).round()}%'), textAlign: TextAlign.end, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                  ),
                ],
              ]),
            ),
          ]),
        ),
      ));
    }
    return Container(
      decoration: homeCard(context, radius: 24),
      clipBehavior: Clip.antiAlias,
      child: Column(children: out),
    );
  }
}
