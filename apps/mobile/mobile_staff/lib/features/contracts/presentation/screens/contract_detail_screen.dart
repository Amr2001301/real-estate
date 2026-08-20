import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/staff_contract.dart';
import '../cubit/contract_detail_cubit.dart';

class ContractDetailScreen extends StatefulWidget {
  const ContractDetailScreen({super.key, this.fallback});
  final StaffContract? fallback;

  @override
  State<ContractDetailScreen> createState() => _ContractDetailScreenState();
}

class _ContractDetailScreenState extends State<ContractDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ContractDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      body: Column(
        children: [
          BlocBuilder<ContractDetailCubit, ContractDetailState>(
            buildWhen: (a, b) => a.contract?.contractNumber != b.contract?.contractNumber,
            builder: (context, state) => AppNavHeader(
              title: state.contract?.contractNumber != null
                  ? '#${state.contract!.contractNumber}'
                  : (widget.fallback?.contractNumber != null
                      ? '#${widget.fallback!.contractNumber}'
                      : l10n.navContracts),
              leadingAction: NavHeaderAction(
                icon: Icons.arrow_back_ios_new_rounded,
                onTap: () => context.pop(),
              ),
            ),
          ),
          Expanded(
            child: BlocBuilder<ContractDetailCubit, ContractDetailState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const Center(child: CircularProgressIndicator());
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => context.read<ContractDetailCubit>().load(),
                    );
                  case DataStatus.empty:
                  case DataStatus.success:
                    return _body(context, state.contract!);
                }
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(BuildContext context, StaffContractDetail contract) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final isSigned = contract.status == StaffContractStatus.signed;
    final isAdmin = context.read<SessionCubit>().state.role == AppRole.admin;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        // ── Status + contract number ─────────────────────────────────────
        AppCard(
          elevation: AppCardElevation.soft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      contract.contractNumber != null
                          ? '#${contract.contractNumber}'
                          : l10n.navContracts,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  StatusBadge(
                    label: isSigned
                        ? l10n.contractStatusSigned
                        : l10n.contractStatusDraft,
                    tone: isSigned ? BadgeTone.success : BadgeTone.neutral,
                  ),
                ],
              ),
              if (contract.signedAt != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${l10n.contractSignedDate}  ${_formatDate(contract.signedAt!)}',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: colors.inkMuted),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),

        // ── Customer + unit ──────────────────────────────────────────────
        AppCard(
          elevation: AppCardElevation.soft,
          child: Column(
            children: [
              _Row(
                label: l10n.contractCustomer,
                value: contract.customerName,
                sub: contract.customerPhone,
              ),
              const Divider(height: AppSpacing.lg),
              _Row(
                label: l10n.contractUnit,
                value: [
                  if (contract.unitCode != null) contract.unitCode!,
                  if (contract.unitType != null) contract.unitType!,
                ].join(' · '),
                sub: contract.projectName?.resolve(lang),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),

        // ── Financial summary ────────────────────────────────────────────
        AppCard(
          elevation: AppCardElevation.soft,
          child: Column(
            children: [
              _Row(
                label: l10n.contractTotalAmount,
                value: PriceFormatter.format(
                    contract.totalAmount, languageCode: lang),
                highlight: true,
              ),
              if (contract.downPaymentAmount != null) ...[
                const Divider(height: AppSpacing.lg),
                _Row(
                  label: l10n.contractDownPayment,
                  value: PriceFormatter.format(
                      contract.downPaymentAmount, languageCode: lang),
                ),
              ],
              if (contract.installmentPlanMonths != null) ...[
                const Divider(height: AppSpacing.lg),
                _Row(
                  label: l10n.contractInstallmentLabel,
                  value: '${contract.installmentPlanMonths} mo',
                  sub: contract.installmentPlanMonthlyAmount != null
                      ? '${l10n.contractMonthlyPayment}: ${PriceFormatter.format(contract.installmentPlanMonthlyAmount, languageCode: lang)}'
                      : null,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),

        // ── Sales rep ────────────────────────────────────────────────────
        if (contract.salesName != null) ...[
          AppCard(
            elevation: AppCardElevation.soft,
            child: _Row(
              label: l10n.contractSalesRep,
              value: contract.salesName,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],

        // ── Documents ────────────────────────────────────────────────────
        OutlinedButton.icon(
          icon: const Icon(Icons.folder_outlined),
          label: Text(l10n.contractsDocumentsTitle),
          onPressed: () => context.push(
            '/documents-view?ownerType=CONTRACT&ownerId=${contract.id}'
            '&title=${Uri.encodeComponent(l10n.contractsDocumentsTitle)}',
          ),
        ),
        const SizedBox(height: AppSpacing.sm),

        // ── Installments ─────────────────────────────────────────────────
        if (contract.installments.isNotEmpty) ...[
          Text(
            l10n.contractInstallmentLabel,
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(color: colors.inkMuted),
          ),
          const SizedBox(height: AppSpacing.xs),
          ...contract.installments.map((inst) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                child: AppCard(
                  elevation: AppCardElevation.soft,
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _installmentTypeLabel(l10n, inst.type),
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                            if (inst.dueDate != null)
                              Text(
                                _formatDate(inst.dueDate!),
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(color: colors.inkMuted),
                              ),
                          ],
                        ),
                      ),
                      if (inst.amount != null)
                        Text(
                          PriceFormatter.format(inst.amount, languageCode: lang),
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: colors.brandGold,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      const SizedBox(width: AppSpacing.sm),
                      StatusBadge(
                        label: inst.isPaid
                            ? l10n.depositVerified
                            : inst.isOverdue
                                ? 'Overdue'
                                : l10n.depositPending,
                        tone: inst.isPaid
                            ? BadgeTone.success
                            : inst.isOverdue
                                ? BadgeTone.error
                                : BadgeTone.neutral,
                      ),
                      if (isAdmin && !inst.isPaid) ...[
                        const SizedBox(width: AppSpacing.sm),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline_rounded),
                          tooltip: l10n.recordDeposit,
                          onPressed: () async {
                            final recorded = await context.push<bool>(
                              '/deposits/record',
                              extra: {
                                'contractId': contract.id,
                                'installmentId': inst.id,
                                'amount': inst.amount ?? 0.0,
                                'label': _installmentTypeLabel(l10n, inst.type) +
                                    (inst.dueDate != null
                                        ? '  ·  ${_formatDate(inst.dueDate!)}'
                                        : ''),
                              },
                            );
                            if (recorded == true && context.mounted) {
                              context.read<ContractDetailCubit>().load();
                            }
                          },
                        ),
                      ],
                    ],
                  ),
                ),
              )),
        ],
      ],
    );
  }

  String _installmentTypeLabel(dynamic l10n, String type) => switch (type) {
        'DOWN_PAYMENT' => l10n.depositTypeDownPayment as String,
        'INSTALLMENT' => l10n.depositTypeInstallment as String,
        'FINAL_PAYMENT' => l10n.depositTypeFinal as String,
        _ => type,
      };

  String _formatDate(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/'
      '${dt.month.toString().padLeft(2, '0')}/'
      '${dt.year}';
}

class _Row extends StatelessWidget {
  const _Row({
    required this.label,
    this.value,
    this.sub,
    this.highlight = false,
  });

  final String label;
  final String? value;
  final String? sub;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: colors.inkMuted),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              value ?? '—',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: highlight ? FontWeight.w700 : null,
                    color: highlight ? colors.brandGold : null,
                  ),
            ),
            if (sub != null)
              Text(
                sub!,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: colors.inkMuted),
              ),
          ],
        ),
      ],
    );
  }
}
