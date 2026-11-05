import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../domain/entities/contract_statement.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyLight = Color(0xFF243F62);

/// The share of the contract paid so far, 0–1: what was paid over the
/// contract value and its fees.
double paidShare(ContractStatement s) {
  final total = s.contractValue + s.fees;
  if (total <= 0) return 0;
  return (s.paid / total).clamp(0.0, 1.0);
}

/// «ملخص السداد» — the contract value, a bar of how much of it is paid, and
/// the paid and remaining amounts. Same figures as the statement of account.
class ContractMoneyCard extends StatelessWidget {
  const ContractMoneyCard({super.key, required this.statement, this.showAsOf = false});

  final ContractStatement statement;

  /// Under the figures: the date the statement is as of (the statement screen).
  final bool showAsOf;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final s = statement;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);
    final share = paidShare(s);
    final percent = percentLabel((share * 100).roundToDouble());
    return Container(
      key: const Key('contract-money'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [_navyLight, _navyDeep], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(AppRadii.xl),
        boxShadow: [BoxShadow(color: _navyDeep.withValues(alpha: 0.25), blurRadius: 18, offset: const Offset(0, 8))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.statementContractValue,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              money(s.contractValue + s.fees),
              style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900, height: 1.1),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: share,
              minHeight: 8,
              backgroundColor: Colors.white.withValues(alpha: 0.14),
              valueColor: const AlwaysStoppedAnimation(AppPalette.gold400),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            l10n.contractPaidShare(percent),
            style: const TextStyle(color: AppPalette.gold300, fontSize: 12, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(child: _Figure(label: l10n.statementPaid, value: money(s.paid), dot: const Color(0xFF34D399))),
              Container(width: 1, height: 36, color: Colors.white.withValues(alpha: 0.12)),
              const SizedBox(width: AppSpacing.md),
              Expanded(child: _Figure(label: l10n.contractRemaining, value: money(s.balance), dot: AppPalette.gold400)),
            ],
          ),
          if (showAsOf) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.statementAsOf(DateFormatter.mediumDate(s.asOf, languageCode: lang)),
              style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.label, required this.value, required this.dot});
  final String label;
  final String value;
  final Color dot;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(width: 7, height: 7, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
          ],
        ),
        const SizedBox(height: 2),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: AlignmentDirectional.centerStart,
          child: Text(value, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
        ),
      ],
    );
  }
}

/// A gold-barred section title, as on the other account screens.
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.trailing});
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 3,
          height: 18,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppPalette.gold400, AppPalette.gold300],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: colors.inkStrong),
          ),
        ),
        ?trailing,
      ],
    );
  }
}
