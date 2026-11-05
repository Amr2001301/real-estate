import 'package:core/core.dart';
import 'package:flutter/material.dart';

import 'period.dart';

/// The period bar: the month shown, a tap to choose another.
class PeriodBar extends StatelessWidget {
  const PeriodBar({super.key, required this.period, required this.onPick, this.extra = const []});
  final String period;
  final ValueChanged<String> onPick;

  /// Periods to offer besides the last twelve months (those that have data).
  final List<String> extra;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
      child: Material(
        color: colors.surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          key: const Key('period-bar'),
          borderRadius: BorderRadius.circular(14),
          onTap: () async {
            final p = await pickPeriod(context, current: period, extra: extra);
            if (p != null) onPick(p);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: colors.hairline, width: 1.5)),
            child: Row(children: [
              const Icon(Icons.calendar_month_rounded, size: 19, color: AppPalette.gold600),
              const SizedBox(width: 8),
              Expanded(child: Text(periodLabel(period, lang), style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: colors.inkStrong))),
              Icon(Icons.expand_more_rounded, color: colors.inkMuted),
            ]),
          ),
        ),
      ),
    );
  }
}

/// A sheet of months: the last twelve and any the data has.
Future<String?> pickPeriod(BuildContext context, {required String current, List<String> extra = const []}) {
  final l10n = context.l10n;
  final lang = Localizations.localeOf(context).languageCode;
  final now = DateTime.now();
  final months = <String>{
    for (var i = 0; i < 12; i++) () {
      final d = DateTime(now.year, now.month - i);
      return '${d.year}-${d.month.toString().padLeft(2, '0')}';
    }(),
    ...extra,
    current,
  }.toList()
    ..sort((a, b) => b.compareTo(a));
  return showModalBottomSheet<String>(
    context: context,
    backgroundColor: context.appColors.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    builder: (ctx) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const SizedBox(height: 10),
        Container(width: 42, height: 5, decoration: BoxDecoration(color: const Color(0xFFD9D0C2), borderRadius: BorderRadius.circular(9))),
        Padding(padding: const EdgeInsets.all(14), child: Text(l10n.tmPeriodPick, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
        Flexible(
          child: ListView(shrinkWrap: true, children: [
            for (final m in months)
              ListTile(
                key: Key('period-$m'),
                title: Text(periodLabel(m, lang)),
                trailing: m == current ? const Icon(Icons.check_rounded, color: AppPalette.gold600) : null,
                onTap: () => Navigator.pop(ctx, m),
              ),
          ]),
        ),
      ]),
    ),
  );
}
