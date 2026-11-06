import 'package:core/core.dart';
import 'package:flutter/material.dart';

import 'admin_home_data.dart';

/// A thin bar split in coloured parts by their share of the whole.
class _SplitBar extends StatelessWidget {
  const _SplitBar({required this.parts, this.height = 8});
  final List<(double, Color)> parts;
  final double height;

  @override
  Widget build(BuildContext context) {
    final total = parts.fold<double>(0, (a, p) => a + p.$1);
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: SizedBox(
        height: height,
        child: total <= 0
            ? ColoredBox(color: context.appColors.hairline)
            : Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                for (final p in parts)
                  if (p.$1 > 0) Expanded(flex: (p.$1 / total * 1000).round().clamp(1, 1000), child: ColoredBox(color: p.$2)),
              ]),
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot(this.color, this.label);
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 5),
        Text(label, style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
      ]);
}

String _money(BuildContext context, double v) {
  final l10n = context.l10n;
  final sym = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
  return '${homeCompactText(v, l10n)} $sym';
}

/// Each project's stock — sold, booked, available — and its signed contracts.
class AdminProjectHealth extends StatelessWidget {
  const AdminProjectHealth({super.key, required this.projects, this.onOpen});
  final List<AdminProject> projects;
  final void Function(AdminProject)? onOpen;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return Column(children: [
      for (final p in projects)
        Container(
          key: Key('ah-project-${p.id}'),
          margin: const EdgeInsets.only(bottom: 10),
          decoration: homeCard(context, radius: 22),
          child: InkWell(
            borderRadius: BorderRadius.circular(22),
            onTap: onOpen == null ? null : () => onOpen!(p),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(color: homeTint(context), borderRadius: BorderRadius.circular(12), border: Border.all(color: homeTintBorder(context))),
                    child: const Icon(Icons.apartment_rounded, size: 20, color: AppPalette.gold500),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(15.5, colors.inkStrong)),
                      const SizedBox(height: 2),
                      Text(l10n.ahProjectContracts(p.contracts, _money(context, p.value)),
                          style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    ]),
                  ),
                  Text(ltr('${p.total}'), style: homeDisplay(18, colors.inkStrong)),
                  const SizedBox(width: 3),
                  Text(l10n.ahUnitsWord, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                ]),
                const SizedBox(height: 12),
                _SplitBar(parts: [
                  (p.sold.toDouble(), AppPalette.navy),
                  (p.reserved.toDouble(), AppPalette.gold500),
                  (p.available.toDouble(), colors.success),
                ]),
                const SizedBox(height: 8),
                Wrap(spacing: 14, runSpacing: 4, children: [
                  _Dot(AppPalette.navy, l10n.ahProjectSold(p.sold)),
                  _Dot(AppPalette.gold500, l10n.ahProjectReserved(p.reserved)),
                  _Dot(colors.success, l10n.ahProjectAvailable(p.available)),
                ]),
              ]),
            ),
          ),
        ),
    ]);
  }
}

/// The signed contracts' value by state, and the fees collected apart.
class AdminFinanceHealth extends StatelessWidget {
  const AdminFinanceHealth({super.key, required this.portfolio, required this.fees});
  final AdminPortfolio portfolio;
  final double fees;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final rows = <(String, double, Color)>[
      (l10n.ahPfPaid, portfolio.paid, colors.success),
      (l10n.ahPfAwaiting, portfolio.awaiting, AppPalette.gold500),
      (l10n.ahPfOverdue, portfolio.overdue, colors.error),
      (l10n.ahPfNotYetDue, portfolio.notYetDue, AppPalette.navy),
      (l10n.ahPfUnscheduled, portfolio.unscheduled, colors.inkMuted),
    ];
    final total = portfolio.total;
    return Container(
      key: const Key('ah-finance-health'),
      padding: const EdgeInsets.all(14),
      decoration: homeCard(context, radius: 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _SplitBar(height: 12, parts: [for (final r in rows) (r.$2, r.$3)]),
        const SizedBox(height: 14),
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(children: [
              Container(width: 9, height: 9, decoration: BoxDecoration(color: r.$3, shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Expanded(child: Text(r.$1, style: TextStyle(fontSize: 13, color: colors.ink))),
              Text(total > 0 ? '${(r.$2 / total * 100).round()}%' : '—', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              const SizedBox(width: 10),
              Text(ltr(_money(context, r.$2)), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            ]),
          ),
        if (fees > 0) ...[
          Divider(height: 18, color: colors.hairline),
          Row(children: [
            Icon(Icons.receipt_rounded, size: 16, color: colors.inkMuted),
            const SizedBox(width: 8),
            Expanded(child: Text(l10n.ahFees, style: TextStyle(fontSize: 12.5, color: colors.inkMuted))),
            Text(ltr(_money(context, fees)), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
          ]),
        ],
      ]),
    );
  }
}

/// What falls due in the next 30, 60 and 90 days, and what is already late.
class AdminCashFlow extends StatelessWidget {
  const AdminCashFlow({super.key, required this.forecast, required this.overdue});
  final List<double> forecast;
  final double overdue;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final slots = <(String, double, Color)>[
      (l10n.ahCfSlot30, forecast[0], AppPalette.navy),
      (l10n.ahCfSlot60, forecast[1], AppPalette.gold500),
      (l10n.ahCfSlot90, forecast[2], colors.success),
      (l10n.ahCfOverdue, overdue, colors.error),
    ];
    final total = slots.fold<double>(0, (a, s) => a + s.$2);
    final max = slots.fold<double>(1, (m, s) => s.$2 > m ? s.$2 : m);
    return Container(
      key: const Key('ah-cash-flow'),
      padding: const EdgeInsets.all(14),
      decoration: homeCard(context, radius: 24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: Text(l10n.ahCfTotal, style: TextStyle(fontSize: 12, color: colors.inkMuted))),
          const SizedBox(width: 8),
          Text(ltr(_money(context, total)), style: homeDisplay(18, colors.inkStrong)),
        ]),
        const SizedBox(height: 10),
        for (final s in slots)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text(s.$1, style: TextStyle(fontSize: 12.5, color: colors.ink))),
                Text(total > 0 ? '${(s.$2 / total * 100).round()}%' : '—', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                const SizedBox(width: 10),
                Text(ltr(_money(context, s.$2)), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
              ]),
              const SizedBox(height: 5),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(value: s.$2 / max, minHeight: 7, color: s.$3, backgroundColor: colors.hairline),
              ),
            ]),
          ),
      ]),
    );
  }
}

/// Where the leads come from, most first, the small ones gathered in «أخرى».
class AdminLeadSources extends StatelessWidget {
  const AdminLeadSources({super.key, required this.sources});
  final List<(String, int)> sources;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final shown = sources.take(5).toList();
    final rest = sources.skip(5).fold<int>(0, (a, s) => a + s.$2);
    if (rest > 0) shown.add((l10n.ahSourcesOther, rest));
    final total = shown.fold<int>(0, (a, s) => a + s.$2);
    final max = shown.fold<int>(1, (m, s) => s.$2 > m ? s.$2 : m);
    return Container(
      key: const Key('ah-lead-sources'),
      padding: const EdgeInsets.all(14),
      decoration: homeCard(context, radius: 24),
      child: Column(children: [
        for (var i = 0; i < shown.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text(shown[i].$1, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: colors.ink))),
                Text('${(shown[i].$2 / total * 100).round()}%', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                const SizedBox(width: 10),
                Text(ltr('${shown[i].$2}'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
              ]),
              const SizedBox(height: 5),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                    value: shown[i].$2 / max, minHeight: 7, color: i == 0 ? AppPalette.gold500 : AppPalette.navy600, backgroundColor: colors.hairline),
              ),
            ]),
          ),
      ]),
    );
  }
}
