import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../home_summary/presentation/home_summary_cubit.dart';
import '../../notifications/presentation/widgets/customer_notification_button.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Finance Hub Screen
// ─────────────────────────────────────────────────────────────────────────────

class FinanceHubScreen extends StatelessWidget {
  const FinanceHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state;
    final displayName = session.sessionOrNull?.displayName ?? session.sessionOrNull?.email;

    return Column(
      children: [
        _FinanceHeader(displayName: displayName, l10n: l10n),
        Expanded(
          child: ListView(
            padding: EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 110 + MediaQuery.of(context).padding.bottom),
            children: [
              BlocBuilder<HomeSummaryCubit, HomeSummaryState>(
                builder: (context, state) {
                  final inst = state.data?.installments;
                  if (inst == null) return const SizedBox.shrink();
                  final next = inst.nextDue;
                  final lang = Localizations.localeOf(context).languageCode;
                  final (amount, unit) = next == null ? ('—', '') : homeCompact(num.tryParse(next.amount) ?? 0, l10n);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: HomeBand(figures: [
                      HomeFigure(
                        id: 'paid',
                        value: '${inst.paidCount}/${inst.totalCount}',
                        label: l10n.installmentsTitle,
                        hint: l10n.financeInstallmentsPaid,
                      ),
                      HomeFigure(
                        id: 'overdue',
                        value: '${inst.overdueCount}',
                        label: l10n.financeOverdue,
                        hint: inst.overdueCount == 0 ? l10n.financeAllOnTime : l10n.financeNeedsPayment,
                        warn: inst.overdueCount > 0,
                      ),
                      HomeFigure(
                        id: 'next',
                        value: amount,
                        label: l10n.financeNextInstallment,
                        hint: next == null ? '—' : [if (unit.isNotEmpty) unit, DateFormatter.shortDate(next.dueDate, languageCode: lang)].join(' · '),
                        warn: next?.isOverdue ?? false,
                      ),
                    ]),
                  );
                },
              ),
              HomeSection(
                icon: Icons.account_balance_wallet_rounded,
                title: l10n.financeServices,
                child: Column(children: [
                  _PortalCard(
                    icon: AppIcons.installments,
                    title: l10n.installmentsTitle,
                    subtitle: l10n.financeInstallmentsDesc,
                    onTap: () => context.push('/account/installments'),
                  ),
                  const SizedBox(height: 10),
                  _PortalCard(
                    icon: AppIcons.deposit,
                    title: l10n.accountDeposits,
                    subtitle: l10n.financeDepositsDesc,
                    onTap: () => context.push('/account/deposits'),
                  ),
                  const SizedBox(height: 10),
                  _PortalCard(
                    icon: AppIcons.contract,
                    title: l10n.accountContracts,
                    subtitle: l10n.financeContractsDesc,
                    onTap: () => context.push('/account/contracts'),
                  ),
                ]),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Screen header ─────────────────────────────────────────────────────────────

class _FinanceHeader extends StatelessWidget {
  const _FinanceHeader({required this.displayName, required this.l10n});

  final String? displayName;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return AppNavHeader(
      title: l10n.navFinance,
      subtitle: l10n.financeSubtitle,
      compact: true,
      leadingAction: GestureDetector(
        onTap: () => context.push('/account/profile'),
        child: _GoldRingAvatar(name: displayName),
      ),
      actions: const [CustomerNotificationButton()],
    );
  }
}

// ── Portal card ───────────────────────────────────────────────────────────────

class _PortalCard extends StatelessWidget {
  const _PortalCard({required this.icon, required this.title, required this.subtitle, required this.onTap});

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: homeCard(context, radius: 22),
          child: Row(children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(15)),
              child: Icon(icon, color: AppPalette.gold300, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: homeDisplay(16, colors.inkStrong)),
                const SizedBox(height: 3),
                Text(subtitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, height: 1.45, color: colors.inkMuted)),
              ]),
            ),
            const SizedBox(width: 6),
            Icon(AppIcons.chevronForward, size: 20, color: colors.inkMuted),
          ]),
        ),
      ),
    );
  }
}

// ── Shared: gold ring avatar ──────────────────────────────────────────────────

class _GoldRingAvatar extends StatelessWidget {
  const _GoldRingAvatar({required this.name});
  final String? name;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.75),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.26),
            blurRadius: 14,
            spreadRadius: 1,
          ),
        ],
      ),
      child: GradientAvatar(name: name, size: 48),
    );
  }
}
