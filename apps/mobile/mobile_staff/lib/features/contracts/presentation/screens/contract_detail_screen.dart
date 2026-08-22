import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/staff_contract.dart';
import '../cubit/contract_detail_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid  = Color(0xFF14273F);

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

  static String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return '?';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  static String _fmtDate(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/'
      '${dt.month.toString().padLeft(2, '0')}/'
      '${dt.year}';

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocBuilder<ContractDetailCubit, ContractDetailState>(
          builder: (context, state) {
            final topInset = MediaQuery.paddingOf(context).top;
            Widget body;
            if (state.status == DataStatus.initial ||
                state.status == DataStatus.loading) {
              body = _HeroShell(
                topInset: topInset,
                child: const Center(
                    child:
                        CircularProgressIndicator(color: AppPalette.gold400)),
              );
            } else if (state.status == DataStatus.failure) {
              body = _HeroShell(
                topInset: topInset,
                child: Center(
                  child: ErrorState(
                    failure: state.failure,
                    onRetry: () =>
                        context.read<ContractDetailCubit>().load(),
                  ),
                ),
              );
            } else {
              body = _SuccessBody(
                topInset: topInset,
                contract: state.contract!,
                initials: _initials(state.contract!.customerName ??
                    widget.fallback?.customerName),
                fmtDate: _fmtDate,
              );
            }
            return Stack(
              children: [
                body is _HeroShell
                    ? CustomScrollView(
                        physics: const NeverScrollableScrollPhysics(),
                        slivers: [SliverToBoxAdapter(child: body)],
                      )
                    : body,
                PositionedDirectional(
                  top: topInset + 10,
                  start: 14,
                  child: _CircleBack(onTap: () => context.pop()),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ── Success body ──────────────────────────────────────────────────────────────

class _SuccessBody extends StatelessWidget {
  const _SuccessBody({
    required this.topInset,
    required this.contract,
    required this.initials,
    required this.fmtDate,
  });

  final double topInset;
  final StaffContractDetail contract;
  final String initials;
  final String Function(DateTime) fmtDate;

  @override
  Widget build(BuildContext context) {
    final l10n    = context.l10n;
    final lang    = Localizations.localeOf(context).languageCode;
    final c       = contract;
    final isSigned = c.status == StaffContractStatus.signed;
    final isAdmin =
        context.read<SessionCubit>().state.role == AppRole.admin;

    return CustomScrollView(
      physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics()),
      slivers: [
        SliverToBoxAdapter(
          child: _HeroCard(
            contract: c,
            initials: initials,
            topInset: topInset,
            l10n: l10n,
            lang: lang,
            fmtDate: fmtDate,
            isSigned: isSigned,
          ),
        ),
        SliverPadding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.xl,
            AppSpacing.lg,
            MediaQuery.paddingOf(context).bottom + 32,
          ),
          sliver: SliverList.list(children: [
            // ── Financial summary ─────────────────────────────────────────
            _SectionLabel(l10n.contractTotalAmount),
            const SizedBox(height: AppSpacing.sm),
            _FinancialCard(
              contract: c,
              l10n: l10n,
              lang: lang,
            ),
            const SizedBox(height: AppSpacing.lg),

            // ── Sales rep ─────────────────────────────────────────────────
            if (c.salesName != null) ...[
              _InfoCard(
                icon: Icons.badge_rounded,
                title: l10n.contractSalesRep,
                body: c.salesName!,
              ),
              const SizedBox(height: AppSpacing.md),
            ],

            // ── Documents ─────────────────────────────────────────────────
            _DocumentsButton(
              l10n: l10n,
              contractId: c.id,
            ),
            const SizedBox(height: AppSpacing.xl),

            // ── Installments ──────────────────────────────────────────────
            if (c.installments.isNotEmpty) ...[
              _SectionLabel(l10n.contractInstallmentLabel),
              const SizedBox(height: AppSpacing.md),
              _InstallmentList(
                installments: c.installments,
                contractId: c.id,
                isAdmin: isAdmin,
                l10n: l10n,
                lang: lang,
                fmtDate: fmtDate,
              ),
            ],
          ]),
        ),
      ],
    );
  }
}

// ── Hero card ─────────────────────────────────────────────────────────────────

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.contract,
    required this.initials,
    required this.topInset,
    required this.l10n,
    required this.lang,
    required this.fmtDate,
    required this.isSigned,
  });

  final StaffContractDetail contract;
  final String initials;
  final double topInset;
  final AppLocalizations l10n;
  final String lang;
  final String Function(DateTime) fmtDate;
  final bool isSigned;

  @override
  Widget build(BuildContext context) {
    final c = contract;
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1A3255), _navyMid, _navyDeep],
          stops: [0.0, 0.45, 1.0],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -50, right: -50,
            child: Container(
              width: 200, height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.14),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          const Positioned(
            bottom: 0, left: 0, right: 0, height: 1,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Color(0x00B8941F),
                    AppPalette.gold400,
                    Color(0x00B8941F),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              topInset + 56,
              AppSpacing.lg,
              AppSpacing.xl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Avatar
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      colors: [AppPalette.gold300, AppPalette.gold500],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppPalette.gold400.withValues(alpha: 0.50),
                        blurRadius: 24,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      initials,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Signed / Draft pill
                _StatusPill(
                  label: isSigned
                      ? l10n.contractStatusSigned
                      : l10n.contractStatusDraft,
                  color: isSigned
                      ? const Color(0xFF22C55E)
                      : Colors.white.withValues(alpha: 0.25),
                ),
                const SizedBox(height: 12),

                // Contract number
                if (c.contractNumber != null)
                  Text(
                    '#${c.contractNumber}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -0.3,
                    ),
                  ),
                const SizedBox(height: 6),

                // Customer name
                if (c.customerName != null)
                  Text(
                    c.customerName!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.80),
                    ),
                  ),

                // Unit · Project
                if (c.unitCode != null ||
                    c.projectName?.resolve(lang) != null) ...[
                  const SizedBox(height: 5),
                  Text(
                    [
                      if (c.unitCode != null) c.unitCode!,
                      if (c.unitType != null) c.unitType!,
                      if (c.projectName?.resolve(lang) != null)
                        c.projectName!.resolve(lang),
                    ].join(' · '),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.white.withValues(alpha: 0.60),
                    ),
                  ),
                ],

                // Signed date
                if (isSigned && c.signedAt != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFF22C55E).withValues(alpha: 0.15),
                      borderRadius: AppRadii.pillAll,
                      border: Border.all(
                          color: const Color(0xFF22C55E)
                              .withValues(alpha: 0.35),
                          width: 0.8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.verified_outlined,
                            size: 13, color: Color(0xFF22C55E)),
                        const SizedBox(width: 5),
                        Text(
                          '${l10n.contractSignedDate}  ${fmtDate(c.signedAt!)}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF22C55E),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: AppSpacing.xl),

                // Divider
                Container(
                  height: 1,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.transparent,
                        AppPalette.gold400.withValues(alpha: 0.28),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),

                // Phone contact buttons
                _DarkContactButtons(
                    phone: c.customerPhone, l10n: l10n),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Financial summary card ────────────────────────────────────────────────────

class _FinancialCard extends StatelessWidget {
  const _FinancialCard(
      {required this.contract, required this.l10n, required this.lang});
  final StaffContractDetail contract;
  final AppLocalizations l10n;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final c = contract;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          _FinRow(
            label: l10n.contractTotalAmount,
            value: PriceFormatter.format(c.totalAmount, languageCode: lang),
            highlight: true,
            isFirst: true,
          ),
          if (c.downPaymentAmount != null) ...[
            _HDivider(),
            _FinRow(
              label: l10n.contractDownPayment,
              value: PriceFormatter.format(c.downPaymentAmount,
                  languageCode: lang),
            ),
          ],
          if (c.installmentPlanMonths != null) ...[
            _HDivider(),
            _FinRow(
              label: l10n.contractInstallmentLabel,
              value: '${c.installmentPlanMonths} ${l10n.planTemplatesMonths(c.installmentPlanMonths!).split(' ').last}',
              sub: c.installmentPlanMonthlyAmount != null
                  ? '${l10n.contractMonthlyPayment}: ${PriceFormatter.format(c.installmentPlanMonthlyAmount, languageCode: lang)}'
                  : null,
              isLast: true,
            ),
          ],
        ],
      ),
    );
  }
}

class _HDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        height: 1,
        margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        color: context.appColors.hairline.withValues(alpha: 0.5),
      );
}

class _FinRow extends StatelessWidget {
  const _FinRow({
    required this.label,
    required this.value,
    this.sub,
    this.highlight = false,
    this.isFirst = false,
    this.isLast = false,
  });
  final String label;
  final String value;
  final String? sub;
  final bool highlight;
  final bool isFirst;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        isFirst ? AppSpacing.md : AppSpacing.sm,
        AppSpacing.md,
        isLast ? AppSpacing.md : AppSpacing.sm,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: colors.inkMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: highlight ? 16 : 14,
                  fontWeight:
                      highlight ? FontWeight.w800 : FontWeight.w600,
                  color:
                      highlight ? colors.brandGold : colors.inkStrong,
                ),
              ),
              if (sub != null) ...[
                const SizedBox(height: 2),
                Text(
                  sub!,
                  style: TextStyle(
                    fontSize: 12,
                    color: colors.inkMuted,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

// ── Installment list ──────────────────────────────────────────────────────────

class _InstallmentList extends StatelessWidget {
  const _InstallmentList({
    required this.installments,
    required this.contractId,
    required this.isAdmin,
    required this.l10n,
    required this.lang,
    required this.fmtDate,
  });
  final List<ContractInstallment> installments;
  final String contractId;
  final bool isAdmin;
  final AppLocalizations l10n;
  final String lang;
  final String Function(DateTime) fmtDate;

  String _typeLabel(AppLocalizations l, String type) => switch (type) {
        'DOWN_PAYMENT' => l.depositTypeDownPayment,
        'INSTALLMENT'  => l.depositTypeInstallment,
        'FINAL_PAYMENT' => l.depositTypeFinal,
        _ => type,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(
      children: [
        for (int i = 0; i < installments.length; i++) ...[
          _InstallmentTile(
            inst: installments[i],
            typeLabel: _typeLabel(l10n, installments[i].type),
            isAdmin: isAdmin,
            contractId: contractId,
            l10n: l10n,
            lang: lang,
            fmtDate: fmtDate,
            colors: colors,
          ),
          if (i < installments.length - 1)
            const SizedBox(height: AppSpacing.xs),
        ],
      ],
    );
  }
}

class _InstallmentTile extends StatelessWidget {
  const _InstallmentTile({
    required this.inst,
    required this.typeLabel,
    required this.isAdmin,
    required this.contractId,
    required this.l10n,
    required this.lang,
    required this.fmtDate,
    required this.colors,
  });
  final ContractInstallment inst;
  final String typeLabel;
  final bool isAdmin;
  final String contractId;
  final AppLocalizations l10n;
  final String lang;
  final String Function(DateTime) fmtDate;
  final AppColorsExt colors;

  Color get _accentColor => inst.isPaid
      ? const Color(0xFF22C55E)
      : inst.isOverdue
          ? const Color(0xFFEF4444)
          : const Color(0xFFF59E0B);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Accent strip
            Container(
              width: 4,
              decoration: BoxDecoration(
                color: _accentColor,
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                child: Row(
                  children: [
                    // Icon circle
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: _accentColor.withValues(alpha: 0.10),
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: _accentColor.withValues(alpha: 0.25)),
                      ),
                      child: Icon(
                        inst.isPaid
                            ? Icons.check_circle_rounded
                            : inst.isOverdue
                                ? Icons.warning_rounded
                                : Icons.schedule_rounded,
                        size: 17,
                        color: _accentColor,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            typeLabel,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: colors.inkStrong,
                            ),
                          ),
                          if (inst.dueDate != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              fmtDate(inst.dueDate!),
                              style: TextStyle(
                                fontSize: 12,
                                color: colors.inkMuted,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (inst.amount != null)
                          Text(
                            PriceFormatter.format(inst.amount,
                                languageCode: lang),
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: colors.brandGold,
                            ),
                          ),
                        const SizedBox(height: 3),
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
                      ],
                    ),
                    if (isAdmin && !inst.isPaid) ...[
                      const SizedBox(width: 4),
                      IconButton(
                        icon: const Icon(Icons.add_circle_outline_rounded),
                        iconSize: 20,
                        color: colors.inkMuted,
                        visualDensity: VisualDensity.compact,
                        tooltip: l10n.recordDeposit,
                        onPressed: () async {
                          final recorded = await context.push<bool>(
                            '/deposits/record',
                            extra: {
                              'contractId': contractId,
                              'installmentId': inst.id,
                              'amount': inst.amount ?? 0.0,
                              'label': typeLabel +
                                  (inst.dueDate != null
                                      ? '  ·  ${fmtDate(inst.dueDate!)}'
                                      : ''),
                            },
                          );
                          if (recorded == true && context.mounted) {
                            context
                                .read<ContractDetailCubit>()
                                .load();
                          }
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Documents button ──────────────────────────────────────────────────────────

class _DocumentsButton extends StatelessWidget {
  const _DocumentsButton({required this.l10n, required this.contractId});
  final AppLocalizations l10n;
  final String contractId;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: () => context.push(
        '/documents-view?ownerType=CONTRACT&ownerId=$contractId'
        '&title=${Uri.encodeComponent(l10n.contractsDocumentsTitle)}',
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg, vertical: 16),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: colors.hairline),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppPalette.gold400.withValues(alpha: 0.10),
                shape: BoxShape.circle,
                border: Border.all(
                    color: AppPalette.gold400.withValues(alpha: 0.22)),
              ),
              child: const Icon(Icons.folder_rounded,
                  size: 17, color: AppPalette.gold500),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                l10n.contractsDocumentsTitle,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: colors.inkStrong,
                ),
              ),
            ),
            Icon(Icons.chevron_right_rounded,
                size: 20, color: colors.inkMuted),
          ],
        ),
      ),
    );
  }
}

// ── Shared sub-widgets ────────────────────────────────────────────────────────

class _HeroShell extends StatelessWidget {
  const _HeroShell({required this.topInset, required this.child});
  final double topInset;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        height: 300 + topInset,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF1A3255), _navyMid, _navyDeep],
          ),
        ),
        child: child,
      );
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 4,
          height: 20,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppPalette.gold300, AppPalette.gold500],
            ),
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          text,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: colors.inkStrong,
                letterSpacing: -0.2,
              ),
        ),
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard(
      {required this.icon, required this.title, required this.body});
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border:
            Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppPalette.gold400.withValues(alpha: 0.10),
              shape: BoxShape.circle,
              border: Border.all(
                  color: AppPalette.gold400.withValues(alpha: 0.22)),
            ),
            child: Icon(icon, size: 17, color: AppPalette.gold500),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: colors.inkMuted,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: TextStyle(
                    fontSize: 14,
                    color: colors.inkStrong,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.88),
          borderRadius: AppRadii.pillAll,
          border: Border.all(
              color: Colors.white.withValues(alpha: 0.22), width: 0.8),
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
          ),
        ),
      );
}

class _DarkContactButtons extends StatelessWidget {
  const _DarkContactButtons({required this.phone, required this.l10n});
  final String? phone;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final number = phone?.trim() ?? '';
    if (number.isEmpty) return const SizedBox.shrink();
    return Row(
      children: [
        Expanded(
          child: GestureDetector(
            onTap: () => ContactActions.call(number),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadii.pill),
                border: Border.all(
                    color: Colors.white.withValues(alpha: 0.35), width: 1),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.call_rounded,
                      size: 16, color: Colors.white),
                  const SizedBox(width: 6),
                  Text(l10n.contactCall,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Colors.white)),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: GestureDetector(
            onTap: () => ContactActions.whatsApp(number: number),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppPalette.gold300, AppPalette.gold500],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(AppRadii.pill),
                boxShadow: [
                  BoxShadow(
                    color: AppPalette.gold400.withValues(alpha: 0.40),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.chat_rounded,
                      size: 16, color: Colors.white),
                  const SizedBox(width: 6),
                  Text(l10n.contactWhatsapp,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Colors.white)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _CircleBack extends StatelessWidget {
  const _CircleBack({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          shape: BoxShape.circle,
          border: Border.all(
              color: Colors.white.withValues(alpha: 0.30), width: 0.8),
        ),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Icon(
            isRtl
                ? Icons.arrow_forward_ios_rounded
                : Icons.arrow_back_ios_new_rounded,
            size: 16,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}
