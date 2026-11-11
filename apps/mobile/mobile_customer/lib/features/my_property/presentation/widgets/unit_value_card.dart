import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/unit_value.dart';
import '../../domain/repositories/my_property_repository.dart';

/// «قيمة وحدتك» in «عقاري», as on the website: each owned unit's value today
/// at the company's current prices against what was paid, with how the price
/// per meter moved since. The API sends only what the company chose to show;
/// nothing while it loads, on an error, or when there is none.
class UnitValueCard extends StatefulWidget {
  const UnitValueCard({super.key, this.reloadKey = ''});

  /// Changes when the property list reloads, so the values reload with it.
  final String reloadKey;

  @override
  State<UnitValueCard> createState() => _UnitValueCardState();
}

class _UnitValueCardState extends State<UnitValueCard> {
  List<UnitValue> _items = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(UnitValueCard old) {
    super.didUpdateWidget(old);
    if (old.reloadKey != widget.reloadKey) _load();
  }

  Future<void> _load() async {
    final result = await context.read<MyPropertyRepository>().getUnitValues();
    if (!mounted) return;
    if (result case Ok<List<UnitValue>>(:final data)) setState(() => _items = data);
  }

  @override
  Widget build(BuildContext context) {
    if (_items.isEmpty) return const SizedBox.shrink();
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      key: const Key('unit-value'),
      margin: const EdgeInsets.only(top: 12),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: colors.success.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                child: Icon(Icons.trending_up_rounded, size: 20, color: colors.success),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(l10n.unitValueTitle, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(l10n.unitValueSub, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted, height: 1.4)),
                ]),
              ),
            ]),
          ),
          for (var i = 0; i < _items.length; i++) ...[
            if (i > 0) Divider(height: 1, color: colors.hairline.withValues(alpha: 0.45)),
            Padding(padding: const EdgeInsets.all(AppSpacing.md), child: _UnitValueRow(item: _items[i])),
          ],
          Container(
            color: colors.surfaceSoft,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
            child: Text(l10n.unitValueNote, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted, height: 1.45, fontSize: 11.5)),
          ),
        ],
      ),
    );
  }
}

class _UnitValueRow extends StatelessWidget {
  const _UnitValueRow({required this.item});

  final UnitValue item;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    String money(String raw) => PriceFormatter.formatString(raw, languageCode: lang);
    String date(DateTime d) => DateFormatter.mediumDate(d.toLocal(), languageCode: lang);

    final textDir = Directionality.of(context);
    final up = item.isUp;
    final tone = up ? colors.success : colors.error;
    final gain = double.tryParse(item.gain)?.abs() ?? 0;
    final sign = up ? '+' : '−';
    final pct = item.gainPct.abs();
    final pctText = pct == pct.roundToDouble() ? pct.toStringAsFixed(0) : pct.toStringAsFixed(1);

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text.rich(
        TextSpan(children: [
          TextSpan(text: item.projectName.resolve(lang), style: const TextStyle(fontWeight: FontWeight.w700)),
          if (item.unitCode.isNotEmpty) TextSpan(text: '  ·  ${item.unitCode}', style: TextStyle(color: colors.inkMuted, fontWeight: FontWeight.w500)),
        ]),
        style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkStrong),
      ),
      const SizedBox(height: 2),
      Text(l10n.unitValueSince(date(item.purchasedAt)), style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
      const SizedBox(height: AppSpacing.sm),
      Row(children: [
        Expanded(child: _Figure(label: l10n.unitValuePaid, value: money(item.purchasePrice), sub: l10n.unitValuePerMeter(money(item.purchasePricePerMeter)))),
        const SizedBox(width: AppSpacing.sm),
        Expanded(child: _Figure(label: l10n.unitValueNow, value: money(item.currentValue), sub: l10n.unitValuePerMeter(money(item.currentPricePerMeter)))),
      ]),
      const SizedBox(height: AppSpacing.sm),
      Container(
        key: const Key('unit-value-gain'),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: tone.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          Icon(up ? Icons.trending_up_rounded : Icons.trending_down_rounded, size: 20, color: tone),
          const SizedBox(width: 8),
          Expanded(child: Text(up ? l10n.unitValueGain : l10n.unitValueChange, style: theme.textTheme.bodyMedium?.copyWith(color: tone, fontWeight: FontWeight.w600))),
          // The sign stays with the number; the currency sits as in the boxes above.
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(money(gain.toStringAsFixed(2)).replaceFirstMapped(RegExp(r'[\d,.]+'), (m) => '\u2066$sign${m[0]}\u2069'), style: theme.textTheme.titleMedium?.copyWith(color: tone, fontWeight: FontWeight.w800)),
            Text('$sign$pctText%', textDirection: TextDirection.ltr, style: theme.textTheme.bodySmall?.copyWith(color: tone, fontWeight: FontWeight.w700)),
          ]),
        ]),
      ),
      if (item.history.length > 1) ...[
        const SizedBox(height: AppSpacing.md),
        Text(l10n.unitValueChart, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
        const SizedBox(height: 6),
        // Time runs left to right: the purchase under the start, today under the end.
        Directionality(
          textDirection: TextDirection.ltr,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SizedBox(height: 64, child: CustomPaint(painter: _SparklinePainter(item.history.map((p) => p.pricePerMeter).toList(), tone))),
            const SizedBox(height: 4),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              // Each date reads in the language's own direction.
              Text(date(item.history.first.date), textDirection: textDir, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted, fontSize: 11)),
              Text(date(item.history.last.date), textDirection: textDir, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted, fontSize: 11)),
            ]),
          ]),
        ),
      ],
    ]);
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.label, required this.value, required this.sub});

  final String label;
  final String value;
  final String sub;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: colors.surfaceSoft, borderRadius: BorderRadius.circular(14)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
        const SizedBox(height: 4),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: AlignmentDirectional.centerStart,
          child: Text(value, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: colors.inkStrong)),
        ),
        const SizedBox(height: 2),
        Text(sub, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
      ]),
    );
  }
}

/// The price per meter as a line with a soft fill below it.
class _SparklinePainter extends CustomPainter {
  _SparklinePainter(this.values, this.color);

  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final lo = values.reduce((a, b) => a < b ? a : b);
    final hi = values.reduce((a, b) => a > b ? a : b);
    final span = hi - lo == 0 ? 1.0 : hi - lo;
    Offset at(int i) => Offset(i / (values.length - 1) * size.width, size.height - 6 - (values[i] - lo) / span * (size.height - 12));
    final line = Path()..moveTo(at(0).dx, at(0).dy);
    for (var i = 1; i < values.length; i++) {
      line.lineTo(at(i).dx, at(i).dy);
    }
    final fill = Path.from(line)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(fill, Paint()..color = color.withValues(alpha: 0.10));
    canvas.drawPath(
      line,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_SparklinePainter old) => old.values != values || old.color != color;
}
