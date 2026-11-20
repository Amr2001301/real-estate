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
