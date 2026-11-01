import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/staff_list_skeleton.dart';
import '../../leads/presentation/follow_up_labels.dart';
import '../domain/cheque.dart';
import 'cheques_cubit.dart';
import 'cheques_screen.dart';

/// FG-01 — one cheque: its amount and status, the bank and due date, whose
/// it is and what it pays. Read-only: the actions stay on the dashboard.
class ChequeDetailScreen extends StatefulWidget {
  const ChequeDetailScreen({super.key});

  @override
  State<ChequeDetailScreen> createState() => _ChequeDetailScreenState();
}

class _ChequeDetailScreenState extends State<ChequeDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ChequeDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ChequeDetailCubit>();
    final row = cubit.row;

    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: Column(
        children: [
          BlocBuilder<ChequeDetailCubit, DataState<Cheque>>(
            builder: (context, state) {
              final number = state.data?.number ?? row?.number;
              return AppNavHeader(
                title: number != null ? '${l10n.chequeNumberLabel} $number' : l10n.chequesTitle,
                compact: true,
                leadingAction: NavHeaderAction(
                  icon: Icons.arrow_back_ios_new_rounded,
                  onTap: () => context.canPop() ? context.pop() : context.go('/cheques'),
                ),
              );
            },
          ),
          Expanded(
            child: BlocBuilder<ChequeDetailCubit, DataState<Cheque>>(
              builder: (context, state) {
                if (state.isFailure) return ErrorState(failure: state.failure, onRetry: cubit.load);
                final c = state.data;
                if (c == null) return const StaffListSkeleton(rows: 4, lines: 3);
                return RefreshIndicator(onRefresh: cubit.load, child: _Body(cheque: c));
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.cheque});
  final Cheque cheque;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final c = cheque;
    final accent = chequeStatusColor(c.status, colors);
    final dueNow = c.dueForDeposit(DateTime.now());
    String? date(DateTime? d) => d == null ? null : followUpDate(d, lang);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xxl),
      children: [
        // ── Amount + status ──────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(color: accent.withValues(alpha: 0.25)),
            boxShadow: [BoxShadow(color: accent.withValues(alpha: 0.10), blurRadius: 18, offset: const Offset(0, 6))],
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.10),
                  shape: BoxShape.circle,
                  border: Border.all(color: accent.withValues(alpha: 0.30), width: 1.2),
                ),
                child: Icon(Icons.receipt_long_rounded, color: accent, size: 24),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.chequeAmount, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    const SizedBox(height: 2),
                    Text(
                      chequeMoney(c.amount, lang),
                      key: const Key('cheque-amount'),
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: colors.inkStrong),
                    ),
                  ],
                ),
              ),
              StatusBadge(label: chequeStatusLabel(l10n, c.status), tone: chequeStatusTone(c.status)),
            ],
          ),
        ),
        if (dueNow) ...[
          const SizedBox(height: AppSpacing.sm),
          _Banner(icon: Icons.account_balance_rounded, text: l10n.chequeDueForDeposit, color: colors.error),
        ],
        if (c.status == 'BOUNCED' && (c.bounceReason?.trim().isNotEmpty ?? false)) ...[
          const SizedBox(height: AppSpacing.sm),
          _Banner(icon: Icons.error_outline_rounded, text: '${l10n.chequeBounceReason}: ${c.bounceReason}', color: colors.error),
        ],
        const SizedBox(height: AppSpacing.md),

        // ── The cheque ───────────────────────────────────────────────────
        _Card(
          children: [
            _Row(label: l10n.chequeNumberLabel, value: c.number),
            _Row(label: l10n.chequeBank, value: c.bank),
            _Row(label: l10n.chequeDueDate, value: date(c.dueDate), valueColor: dueNow ? colors.error : null),
            if (c.clearingDate != null) _Row(label: l10n.chequeClearedOn, value: date(c.clearingDate)),
            if (c.bounceDate != null) _Row(label: l10n.chequeBouncedOn, value: date(c.bounceDate), valueColor: colors.error),
            if (c.replacedByNumber != null) _Row(label: l10n.chequeReplacedBy, value: '#${c.replacedByNumber}'),
            _Row(label: l10n.chequeRecordedBy, value: c.recordedBy),
          ],
        ),
        const SizedBox(height: AppSpacing.md),

        // ── Whose it is ──────────────────────────────────────────────────
        if (c.customer != null || c.contractNumber != null || c.reservationNumber != null) ...[
          _Card(
            children: [
              _Row(label: l10n.chequeCustomer, value: c.customer),
              if (c.contractNumber != null)
                _Row(
                  label: l10n.chequeContract,
                  value: c.contractNumber,
                  onTap: c.contractId == null ? null : () => context.push('/contracts/${c.contractId}'),
                ),
              if (c.reservationNumber != null)
                _Row(
                  label: l10n.chequeReservation,
                  value: c.reservationNumber,
                  onTap: c.reservationId == null ? null : () => context.push('/reservations/${c.reservationId}'),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
        ],

        // ── What it pays ─────────────────────────────────────────────────
        if (c.payments.isNotEmpty) ...[
          Text(l10n.chequePayments, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: colors.inkStrong)),
          const SizedBox(height: AppSpacing.xs),
          _Card(
            children: [
              for (final p in c.payments)
                _Row(
                  label: p.installmentDue == null ? l10n.chequePayments : '${l10n.chequeInstallmentDue} ${date(p.installmentDue)}',
                  value: chequeMoney(p.amount, lang),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
        ],

        Text(l10n.chequeOnDashboard, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final rows = children.toList();
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) Divider(height: 1, color: colors.hairline, indent: AppSpacing.md, endIndent: AppSpacing.md),
            rows[i],
          ],
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, this.value, this.valueColor, this.onTap});
  final String label;
  final String? value;
  final Color? valueColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 13),
        child: Row(
          children: [
            Expanded(child: Text(label, style: TextStyle(fontSize: 13, color: colors.inkMuted))),
            const SizedBox(width: AppSpacing.sm),
            Flexible(
              child: Text(
                value ?? '—',
                textAlign: TextAlign.end,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: valueColor ?? (onTap != null ? colors.brandNavy : colors.inkStrong),
                ),
              ),
            ),
            if (onTap != null) ...[
              const SizedBox(width: 4),
              Icon(Icons.chevron_right_rounded, size: 16, color: colors.inkMuted),
            ],
          ],
        ),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.icon, required this.text, required this.color});
  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: Text(text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color))),
          ],
        ),
      );
}
