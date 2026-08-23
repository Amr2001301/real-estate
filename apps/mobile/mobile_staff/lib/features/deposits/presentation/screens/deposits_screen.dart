import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/staff_deposit.dart';
import '../cubit/deposits_cubit.dart';

class DepositsScreen extends StatefulWidget {
  const DepositsScreen({super.key, this.contractId});
  final String? contractId;

  @override
  State<DepositsScreen> createState() => _DepositsScreenState();
}

class _DepositsScreenState extends State<DepositsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<DepositsCubit>().load(contractId: widget.contractId);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<DepositsCubit>();
    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.navDeposits,
            compact: true,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          Expanded(
            child: BlocBuilder<DepositsCubit, DepositsListState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(
                        failure: state.failure,
                        onRetry: () => cubit.load());
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: l10n.depositsEmptyTitle,
                      message: l10n.depositsEmptyMessage,
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      color: AppPalette.gold400,
                      onRefresh: () =>
                          cubit.load(contractId: widget.contractId),
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(
                            AppSpacing.lg,
                            AppSpacing.lg,
                            AppSpacing.lg,
                            AppSpacing.xl),
                        itemCount: state.deposits.length,
                        separatorBuilder: (_, i) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) =>
                            _DepositTile(state.deposits[i]),
                      ),
                    );
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Deposit tile ──────────────────────────────────────────────────────────────

class _DepositTile extends StatefulWidget {
  const _DepositTile(this.deposit);
  final StaffDeposit deposit;

  @override
  State<_DepositTile> createState() => _DepositTileState();
}

class _DepositTileState extends State<_DepositTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final d = widget.deposit;

    final isVerified = d.verified;
    final isRejected =
        d.reviewStatus == DepositReviewStatus.rejected;

    final accentColor = isVerified
        ? const Color(0xFF22C55E)
        : isRejected
            ? const Color(0xFFEF4444)
            : const Color(0xFFF59E0B);

    final statusLabel = isVerified
        ? l10n.depositVerified
        : l10n.depositPending;

    final statusTone = isVerified
        ? BadgeTone.success
        : isRejected
            ? BadgeTone.error
            : BadgeTone.warning;

    final typeLabel = d.type != null ? _typeLabel(l10n, d.type!) : null;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: Border.all(
                color: colors.hairline.withValues(alpha: 0.5)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Accent strip
                Container(width: 4, color: accentColor),
                // Content
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm + 2),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Icon circle
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color:
                                accentColor.withValues(alpha: 0.10),
                            shape: BoxShape.circle,
                            border: Border.all(
                                color: accentColor
                                    .withValues(alpha: 0.25)),
                          ),
                          child: Icon(
                            isVerified
                                ? Icons.check_circle_rounded
                                : isRejected
                                    ? Icons.cancel_rounded
                                    : Icons.schedule_rounded,
                            size: 18,
                            color: accentColor,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        // Info
                        Expanded(
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            mainAxisAlignment:
                                MainAxisAlignment.center,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      d.customerName ?? '—',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleSmall
                                          ?.copyWith(
                                              fontWeight:
                                                  FontWeight.w700),
                                      maxLines: 1,
                                      overflow:
                                          TextOverflow.ellipsis,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  StatusBadge(
                                      label: statusLabel,
                                      tone: statusTone),
                                ],
                              ),
                              const SizedBox(height: 3),
                              Text(
                                [
                                  if (d.contractNumber != null)
                                    '#${d.contractNumber}',
                                  if (d.unitCode != null)
                                    d.unitCode!,
                                  ?typeLabel,
                                ].join('  ·  '),
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: colors.inkMuted),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (d.amount != null) ...[
                                const SizedBox(height: 3),
                                Row(
                                  children: [
                                    Text(
                                      PriceFormatter.format(
                                          d.amount,
                                          languageCode: lang),
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            color: colors.brandGold,
                                            fontWeight:
                                                FontWeight.w700,
                                          ),
                                    ),
                                    if (d.paidAt != null) ...[
                                      Text(
                                        '  ·  ',
                                        style: TextStyle(
                                            color: colors.inkMuted,
                                            fontSize: 12),
                                      ),
                                      Text(
                                        _fmtDate(d.paidAt!),
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall
                                            ?.copyWith(
                                                color:
                                                    colors.inkMuted),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _typeLabel(dynamic l10n, String type) => switch (type) {
        'DOWN_PAYMENT' => l10n.depositTypeDownPayment as String,
        'INSTALLMENT' => l10n.depositTypeInstallment as String,
        'FINAL_PAYMENT' => l10n.depositTypeFinal as String,
        'BOOKING' => l10n.depositTypeBooking as String,
        _ => type,
      };

  String _fmtDate(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}';
}
