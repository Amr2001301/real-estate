import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../catalog/kit/catalog_kit.dart';
import 'home_kit.dart';

/// The filter sheet every list uses (owner-approved design, 2026-11-04):
/// a title with how many filters are on and a close button, titled
/// sections, then clear and a gold button that says how many results the
/// choice gives before it is applied.
Future<void> showFilterSheet(BuildContext context, WidgetBuilder builder) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: builder,
    );

class FilterSheet extends StatelessWidget {
  const FilterSheet({
    super.key,
    required this.title,
    required this.active,
    required this.sections,
    required this.onClear,
    required this.onApply,
    required this.applyLabel,
    this.applyKey = const Key('filter-apply'),
  });

  final String title;

  /// How many filters the current choice turns on.
  final int active;
  final List<Widget> sections;
  final VoidCallback onClear;
  final VoidCallback onApply;

  /// "Show 20 contracts", or the plain apply while that is being counted.
  final String applyLabel;
  final Key applyKey;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.88),
      child: Container(
        decoration: const BoxDecoration(
          color: Color(0xFFFBF7F0),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(top: 10, bottom: 10),
              decoration: BoxDecoration(color: const Color(0xFFD9D0C2), borderRadius: BorderRadius.circular(9)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: homeDisplay(19, colors.inkStrong)),
                  Text(l10n.fsActiveN(active),
                      key: const Key('filter-active'),
                      style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppPalette.gold600)),
                ]),
              ),
              Material(
                color: Colors.white,
                shape: const CircleBorder(side: BorderSide(color: Color(0xFFECE4D6))),
                child: InkWell(
                  key: const Key('filter-close'),
                  customBorder: const CircleBorder(),
                  onTap: () => Navigator.of(context).pop(),
                  child: SizedBox(width: 36, height: 36, child: Icon(Icons.close_rounded, size: 19, color: colors.inkStrong)),
                ),
              ),
            ]),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: sections),
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottom),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFFEFE8DC)))),
            child: Row(children: [
              Expanded(
                child: OutlinedButton(
                  key: const Key('filter-clear'),
                  onPressed: onClear,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                    foregroundColor: colors.inkStrong,
                    side: const BorderSide(color: Color(0xFFD9D0C2), width: 1.5),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                    textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                  ),
                  child: Text(l10n.fsClear),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: FilledButton.icon(
                  key: applyKey,
                  onPressed: onApply,
                  icon: const Icon(Icons.tune_rounded, size: 19),
                  label: Text(applyLabel),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                    backgroundColor: AppPalette.gold400,
                    foregroundColor: AppPalette.navy,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                    textStyle: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class FilterSection extends StatelessWidget {
  const FilterSection({super.key, required this.icon, required this.title, required this.child, this.hint});
  final IconData icon;
  final String title;
  final String? hint;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Icon(icon, size: 17, color: AppPalette.gold600),
          const SizedBox(width: 6),
          Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: colors.inkStrong)),
          const Spacer(),
          if (hint != null) Text(hint!, style: TextStyle(fontSize: 11, color: colors.inkMuted)),
        ]),
        const SizedBox(height: 8),
        child,
      ]),
    );
  }
}

/// One choice of a filter: what it sets, what it says, what it counts.
class FilterOption<T> {
  const FilterOption(this.value, this.label, {this.sub, this.icon, this.color, this.empty = false});
  final T value;
  final String label;
  final String? sub;
  final IconData? icon;
  final Color? color;

  /// It gives nothing: drawn faded and not offered.
  final bool empty;
}

/// Two-up cards with an icon, the label and the count; the chosen one is
/// outlined in navy with a check.
class FilterTiles<T> extends StatelessWidget {
  const FilterTiles({super.key, required this.options, required this.selected, required this.onSelect, this.keyPrefix = 'filter-tile'});
  final List<FilterOption<T>> options;
  final T selected;
  final ValueChanged<T> onSelect;
  final String keyPrefix;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return LayoutBuilder(builder: (context, box) {
      final w = (box.maxWidth - 8) / 2;
      return Wrap(spacing: 8, runSpacing: 8, children: [
        for (final o in options)
          Builder(builder: (context) {
            final on = o.value == selected;
            final c = o.color ?? colors.inkStrong;
            return SizedBox(
              width: w,
              child: Opacity(
                opacity: o.empty && !on ? 0.45 : 1,
                child: Stack(clipBehavior: Clip.none, children: [
                  Material(
                    color: on ? const Color(0xFFFFFCF5) : Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: on ? const BorderSide(color: AppPalette.navy, width: 1.6) : const BorderSide(color: Color(0xFFECE4D6)),
                    ),
                    child: InkWell(
                      key: Key('$keyPrefix-${o.value ?? 'all'}'),
                      borderRadius: BorderRadius.circular(16),
                      onTap: o.empty && !on ? null : () => onSelect(o.value),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        child: Row(children: [
                          Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(color: c.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(11)),
                            child: Icon(o.icon ?? Icons.circle_outlined, size: 18, color: c),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(o.label, maxLines: 1, overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                              if (o.sub != null) Text(o.sub!, style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                            ]),
                          ),
                        ]),
                      ),
                    ),
                  ),
                  if (on)
                    PositionedDirectional(
                      top: -6,
                      end: -6,
                      child: Container(
                        width: 20,
                        height: 20,
                        decoration: const BoxDecoration(color: AppPalette.navy, shape: BoxShape.circle),
                        child: const Icon(Icons.check_rounded, size: 13, color: AppPalette.gold300),
                      ),
                    ),
                ]),
              ),
            );
          }),
      ]);
    });
  }
}

/// One track, equal parts, the chosen one raised in white.
class FilterSegments<T> extends StatelessWidget {
  const FilterSegments({super.key, required this.options, required this.selected, required this.onSelect, this.keyPrefix = 'filter-seg'});
  final List<FilterOption<T>> options;
  final T selected;
  final ValueChanged<T> onSelect;
  final String keyPrefix;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: const Color(0xFFEFE8DC), borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        for (final (i, o) in options.indexed) ...[
          if (i > 0) const SizedBox(width: 4),
          Expanded(
            child: GestureDetector(
              key: Key('$keyPrefix-${o.value ?? 'all'}'),
              behavior: HitTestBehavior.opaque,
              onTap: () => onSelect(o.value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                padding: EdgeInsets.symmetric(vertical: o.sub == null ? 10 : 7),
                decoration: BoxDecoration(
                  color: o.value == selected ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(11),
                  boxShadow: o.value == selected ? const [BoxShadow(color: Color(0x1F0F1E33), blurRadius: 8, offset: Offset(0, 2))] : null,
                ),
                child: Column(children: [
                  Text(o.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: o.value == selected ? colors.inkStrong : const Color(0xFF6B6256),
                      )),
                  if (o.sub != null) Text(o.sub!, style: TextStyle(fontSize: 10.5, color: colors.inkMuted)),
                ]),
              ),
            ),
          ),
        ],
      ]),
    );
  }
}

/// A card of rows with a radio, the label and the count — for long lists.
class FilterRadioList<T> extends StatelessWidget {
  const FilterRadioList({super.key, required this.options, required this.selected, required this.onSelect, this.keyPrefix = 'filter-row', this.stacked = false});
  final List<FilterOption<T>> options;
  final T selected;
  final ValueChanged<T> onSelect;
  final String keyPrefix;

  /// The sub-text under the label (a sentence) rather than beside it (a count).
  final bool stacked;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFECE4D6))),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        for (final (i, o) in options.indexed) ...[
          if (i > 0) const Divider(height: 1, color: Color(0xFFF1EBE0)),
          InkWell(
            key: Key('$keyPrefix-${o.value ?? 'all'}'),
            onTap: () => onSelect(o.value),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              child: Row(children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: o.value == selected
                        ? Border.all(color: AppPalette.navy, width: 6)
                        : Border.all(color: const Color(0xFFD9D0C2), width: 2),
                  ),
                ),
                const SizedBox(width: 10),
                if (stacked)
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(o.label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                      if (o.sub != null) Text(o.sub!, style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                    ]),
                  )
                else ...[
                  Expanded(child: Text(o.label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong))),
                  if (o.sub != null) Text(o.sub!, style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                ],
              ]),
            ),
          ),
        ],
      ]),
    );
  }
}

/// From / to with a two-handle slider and quick ranges. Null ends mean
/// "no bound"; the slider's top is "no limit".
class FilterPriceRange extends StatelessWidget {
  const FilterPriceRange({super.key, required this.from, required this.to, required this.onChanged, this.max = 20000000, this.step = 250000});
  final num? from;
  final num? to;
  final void Function(num? from, num? to) onChanged;
  final double max;
  final double step;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lo = (from ?? 0).toDouble().clamp(0.0, max);
    final hi = (to ?? max).toDouble().clamp(lo, max);
    String money(num v) => ltr(catalogGrouped(v));
    String m(int n) => l10n.fsMillion(ltr('$n'));
    final presets = <(String, num?, num?)>[
      (l10n.fsPriceUnder(m(3)), null, 3000000),
      (l10n.fsPriceBetween(ltr('3'), m(7)), 3000000, 7000000),
      (l10n.fsPriceOver(m(7)), 7000000, null),
    ];
    Widget end(String k, String v, CrossAxisAlignment a) => Column(crossAxisAlignment: a, children: [
          Text(k, style: TextStyle(fontSize: 10.5, color: colors.inkMuted)),
          Text(v, style: homeDisplay(15, colors.inkStrong)),
        ]);
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFECE4D6))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          end(l10n.cuPriceFrom, money(lo), CrossAxisAlignment.start),
          const Spacer(),
          end(l10n.cuPriceTo, to == null ? l10n.fsNoLimit : money(hi), CrossAxisAlignment.end),
        ]),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            activeTrackColor: AppPalette.gold400,
            inactiveTrackColor: const Color(0xFFEFE8DC),
            thumbColor: Colors.white,
            overlayColor: AppPalette.gold400.withValues(alpha: 0.12),
            trackHeight: 6,
            rangeThumbShape: const _Thumb(),
          ),
          child: RangeSlider(
            key: const Key('filter-price'),
            values: RangeValues(lo, hi),
            min: 0,
            max: max,
            divisions: (max / step).round(),
            onChanged: (v) => onChanged(v.start <= 0 ? null : v.start, v.end >= max ? null : v.end),
          ),
        ),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final (i, (label, a, b)) in presets.indexed)
            Builder(builder: (context) {
              final on = from == a && to == b;
              return Material(
                color: on ? AppPalette.navy : Colors.white,
                shape: StadiumBorder(side: BorderSide(color: on ? AppPalette.navy : const Color(0xFFECE4D6))),
                child: InkWell(
                  key: Key('filter-price-preset-$i'),
                  customBorder: const StadiumBorder(),
                  onTap: () => on ? onChanged(null, null) : onChanged(a, b),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                    child: Text(label, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: on ? Colors.white : colors.inkStrong)),
                  ),
                ),
              );
            }),
        ]),
      ]),
    );
  }
}

class _Thumb extends RangeSliderThumbShape {
  const _Thumb();

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) => const Size(22, 22);

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    bool isDiscrete = false,
    bool isEnabled = false,
    bool? isOnTop,
    TextDirection? textDirection,
    required SliderThemeData sliderTheme,
    Thumb? thumb,
    bool? isPressed,
  }) {
    final c = context.canvas;
    c.drawCircle(center + const Offset(0, 1), 11, Paint()..color = const Color(0x33000000)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3));
    c.drawCircle(center, 11, Paint()..color = Colors.white);
    c.drawCircle(center, 10, Paint()..color = AppPalette.navy..style = PaintingStyle.stroke..strokeWidth = 2);
  }
}

/// Counts the draft a moment after it stops changing, for the apply label.
mixin FilterCounting<W extends StatefulWidget> on State<W> {
  int? shown;
  int _ticket = 0;

  Future<int?> countDraft();

  void recount() {
    final t = ++_ticket;
    Future<void>.delayed(const Duration(milliseconds: 250), () async {
      if (!mounted || t != _ticket) return;
      final n = await countDraft();
      if (mounted && t == _ticket) setState(() => shown = n);
    });
  }
}
