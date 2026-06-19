import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../notifications/presentation/widgets/customer_notification_button.dart';
import '../../domain/entities/installment.dart';
import '../cubit/installments_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Installments Screen
// ─────────────────────────────────────────────────────────────────────────────

class InstallmentsScreen extends StatefulWidget {
  const InstallmentsScreen({super.key});

  @override
  State<InstallmentsScreen> createState() => _InstallmentsScreenState();
}

class _InstallmentsScreenState extends State<InstallmentsScreen> {
  InstallmentStatus? _filter; // null = all

  @override
  void initState() {
    super.initState();
    context.read<InstallmentsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state;
    final displayName =
        session.sessionOrNull?.displayName ?? session.sessionOrNull?.email;

    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: Column(
        children: [
          _InstallmentsHeader(displayName: displayName, l10n: l10n),

          // ── Filter chips ────────────────────────────────────────────────
          BlocBuilder<InstallmentsCubit, InstallmentsState>(
            builder: (context, state) {
              if (state.status != DataStatus.success) {
                return const SizedBox.shrink();
              }
              return _FilterRow(
                selected: _filter?.name,
                items: [
                  _FilterItem(key: null, label: l10n.filterAny),
                  _FilterItem(
                    key: InstallmentStatus.overdue.name,
                    label: l10n.installmentStatusOverdue,
                  ),
                  _FilterItem(
                    key: InstallmentStatus.pending.name,
                    label: l10n.installmentStatusPending,
                  ),
                  _FilterItem(
                    key: InstallmentStatus.paid.name,
                    label: l10n.installmentStatusPaid,
                  ),
                ],
                onSelect: (k) => setState(() {
                  _filter = k == null
                      ? null
                      : InstallmentStatus.values.firstWhere((s) => s.name == k);
                }),
              );
            },
          ),

          // ── List ────────────────────────────────────────────────────────
          Expanded(
            child: BlocBuilder<InstallmentsCubit, InstallmentsState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const Center(child: CircularProgressIndicator());
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => context.read<InstallmentsCubit>().load(),
                    );
                  case DataStatus.empty:
                    return EmptyState(
                      icon: AppIcons.installments,
                      title: l10n.installmentsEmptyTitle,
                      message: l10n.installmentsEmptyMessage,
                    );
                  case DataStatus.success:
                    final all = state.data!;
                    final visible = _filter == null
                        ? all
                        : all.where((i) => i.status == _filter).toList();
                    return RefreshIndicator(
                      onRefresh: () => context.read<InstallmentsCubit>().load(),
                      child: ListView.separated(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.md,
                          AppSpacing.lg,
                          AppSpacing.xl + MediaQuery.of(context).padding.bottom,
                        ),
                        itemCount: visible.length + 1,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.md),
                        itemBuilder: (context, i) {
                          if (i == 0) {
                            return _InstallmentsSummary(
                              installments: all,
                              l10n: l10n,
                            );
                          }
                          return _InstallmentCard(installment: visible[i - 1]);
                        },
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

// ── Header ────────────────────────────────────────────────────────────────────

class _InstallmentsHeader extends StatelessWidget {
  const _InstallmentsHeader({required this.displayName, required this.l10n});
  final String? displayName;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [_navyLight, _navyCard, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(28),
            bottomRight: Radius.circular(28),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x35000000),
              blurRadius: 22,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 160,
                height: 130,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.09),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 48,
              right: 48,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.0),
                      AppPalette.gold400.withValues(alpha: 0.5),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                topInset + AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _HeaderBackButton(),
                  const SizedBox(width: AppSpacing.md),

                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.financeInstallmentsDesc,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppPalette.gold300,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          l10n.installmentsTitle,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  const CustomerNotificationButton(size: 42),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderBackButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.white,
          size: 16,
        ),
      ),
    );
  }
}

// ── Summary card ──────────────────────────────────────────────────────────────

class _InstallmentsSummary extends StatelessWidget {
  const _InstallmentsSummary({required this.installments, required this.l10n});
  final List<Installment> installments;
  final AppLocalizations l10n;

  static double _sum(Iterable<Installment> items) =>
      items.fold(0.0, (acc, i) => acc + (double.tryParse(i.amount) ?? 0.0));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    final paid = installments
        .where((i) => i.status == InstallmentStatus.paid)
        .toList();
    final overdue = installments
        .where((i) => i.status == InstallmentStatus.overdue)
        .length;
    final pending = installments.length - paid.length - overdue;
    final paidTotal = _sum(paid);

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_navyLight, _navyDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: _navyDeep.withValues(alpha: 0.25),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.08),
            blurRadius: 24,
            spreadRadius: 2,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Paid total
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.installmentStatusPaid,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.6),
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.3,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            PriceFormatter.formatString(
                              paidTotal.toStringAsFixed(0),
                              languageCode: lang,
                            ),
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: AppPalette.gold300,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.15),
                        ),
                      ),
                      child: Text(
                        '${installments.length} ${l10n.installmentsTitle}',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Container(
                  height: 1,
                  color: Colors.white.withValues(alpha: 0.12),
                ),
                const SizedBox(height: AppSpacing.md),
                // Status breakdown
                Row(
                  children: [
                    Expanded(
                      child: _SummaryCell(
                        value: '${paid.length}',
                        label: l10n.installmentStatusPaid,
                        accent: const Color(0xFF4ADE80),
                        theme: theme,
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 40,
                      color: Colors.white.withValues(alpha: 0.15),
                    ),
                    Expanded(
                      child: _SummaryCell(
                        value: '$overdue',
                        label: l10n.installmentStatusOverdue,
                        accent: const Color(0xFFF87171),
                        theme: theme,
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 40,
                      color: Colors.white.withValues(alpha: 0.15),
                    ),
                    Expanded(
                      child: _SummaryCell(
                        value: '$pending',
                        label: l10n.installmentStatusPending,
                        accent: AppPalette.gold300,
                        theme: theme,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCell extends StatelessWidget {
  const _SummaryCell({
    required this.value,
    required this.label,
    required this.accent,
    required this.theme,
  });
  final String value;
  final String label;
  final Color accent;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: theme.textTheme.headlineSmall?.copyWith(
            color: accent,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.65),
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

// ── Installment Card ──────────────────────────────────────────────────────────

class _InstallmentCard extends StatelessWidget {
  const _InstallmentCard({required this.installment});
  final Installment installment;

  static _StripStyle _stripStyle(Installment inst) {
    final proof = inst.latestProof;
    if (proof != null) {
      switch (proof.reviewStatus) {
        case PaymentProofStatus.pendingReview:
          return _StripStyle(
            colors: [const Color(0xFF7A5C1E), const Color(0xFF4A3610)],
            accentColor: const Color(0xFFFBBF24),
            icon: Icons.hourglass_top_rounded,
          );
        case PaymentProofStatus.approved:
          return _StripStyle(
            colors: [const Color(0xFF1B5E3F), const Color(0xFF0D3826)],
            accentColor: const Color(0xFF4ADE80),
            icon: Icons.check_circle_rounded,
          );
        case PaymentProofStatus.rejected:
          return _StripStyle(
            colors: [const Color(0xFF7A1B1B), const Color(0xFF4A0D0D)],
            accentColor: const Color(0xFFF87171),
            icon: Icons.cancel_rounded,
          );
        case PaymentProofStatus.noProof:
        case PaymentProofStatus.unknown:
          break;
      }
    }
    return switch (inst.status) {
      InstallmentStatus.paid => _StripStyle(
        colors: [const Color(0xFF1B5E3F), const Color(0xFF0D3826)],
        accentColor: const Color(0xFF4ADE80),
        icon: Icons.check_circle_rounded,
      ),
      InstallmentStatus.overdue => _StripStyle(
        colors: [const Color(0xFF7A1B1B), const Color(0xFF4A0D0D)],
        accentColor: const Color(0xFFF87171),
        icon: Icons.warning_rounded,
      ),
      _ => _StripStyle(
        colors: [_navyLight, _navyDeep],
        accentColor: AppPalette.gold300,
        icon: AppIcons.installments,
      ),
    };
  }

  String _statusLabel(AppLocalizations l10n) {
    final proof = installment.latestProof;
    if (proof != null) {
      switch (proof.reviewStatus) {
        case PaymentProofStatus.pendingReview:
          return l10n.paymentProofStatusPendingReview;
        case PaymentProofStatus.approved:
          return l10n.paymentProofStatusApproved;
        case PaymentProofStatus.rejected:
          return l10n.paymentProofStatusRejected;
        case PaymentProofStatus.noProof:
        case PaymentProofStatus.unknown:
          break;
      }
    }
    return switch (installment.status) {
      InstallmentStatus.paid => l10n.installmentStatusPaid,
      InstallmentStatus.overdue => l10n.installmentStatusOverdue,
      _ => l10n.installmentStatusPending,
    };
  }

  String _paymentTypeLabel(AppLocalizations l10n) => switch (installment.type) {
    InstallmentPaymentType.downPayment => l10n.depositTypeDownPayment,
    InstallmentPaymentType.finalPayment => l10n.depositTypeFinal,
    _ => l10n.depositTypeInstallment,
  };

  String _paymentMethodLabel(AppLocalizations l10n, PaymentMethod method) =>
      switch (method) {
        PaymentMethod.bankTransfer => l10n.paymentProofMethodBankTransfer,
        PaymentMethod.cheque => 'شيك',
        PaymentMethod.cash => 'نقدي',
        _ => l10n.paymentProofMethodOther,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    final style = _stripStyle(installment);
    final projectName =
        (lang == 'ar' ? installment.projectNameAr : installment.projectNameEn)
            ?.trim();
    final hasLocation = projectName != null || installment.unitCode != null;
    final locationLine = [
      if (projectName?.isNotEmpty ?? false) projectName,
      if (installment.unitCode?.isNotEmpty ?? false) installment.unitCode,
    ].join(' · ');

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 20,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Gradient strip
          SizedBox(
            height: 100,
            child: Stack(
              fit: StackFit.expand,
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: style.colors,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                ),
                const IgnorePointer(child: _DotTexture()),
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    height: 1,
                    color: style.accentColor.withValues(alpha: 0.3),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: style.accentColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: style.accentColor.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Icon(
                          style.icon,
                          color: style.accentColor,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              PriceFormatter.formatString(
                                installment.amount,
                                languageCode: lang,
                              ),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 20,
                                height: 1.0,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 4),
                            if (installment.contractNumber != null)
                              Text(
                                installment.contractNumber!,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.7),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.3,
                                ),
                              ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: style.accentColor.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: style.accentColor.withValues(alpha: 0.4),
                          ),
                        ),
                        child: Text(
                          _statusLabel(l10n),
                          style: TextStyle(
                            color: style.accentColor,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── White body
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.md,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Payment type + project/unit
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [_navyLight, _navyDeep],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        AppIcons.property,
                        size: 16,
                        color: AppPalette.gold300,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _paymentTypeLabel(l10n),
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: colors.inkStrong,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (hasLocation && locationLine.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              locationLine,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colors.inkMuted,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Divider(height: 1, color: colors.hairline),
                const SizedBox(height: AppSpacing.md),

                // Dates row
                Row(
                  children: [
                    Expanded(
                      child: _DateCell(
                        icon: AppIcons.calendar,
                        label: l10n.installmentDueOn(''),
                        value: DateFormatter.shortDate(
                          installment.dueDate,
                          languageCode: lang,
                        ),
                      ),
                    ),
                    if (installment.paidAt != null) ...[
                      Container(
                        width: 1,
                        height: 36,
                        color: colors.hairline,
                        margin: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                        ),
                      ),
                      Expanded(
                        child: _DateCell(
                          icon: Icons.check_circle_outline_rounded,
                          label: 'تاريخ السداد',
                          value: DateFormatter.shortDate(
                            installment.paidAt!,
                            languageCode: lang,
                          ),
                          accent: const Color(0xFF4ADE80),
                        ),
                      ),
                    ],
                  ],
                ),

                // Payment method
                if (installment.latestProof?.paymentMethod != null &&
                    installment.latestProof!.paymentMethod !=
                        PaymentMethod.unknown) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Divider(height: 1, color: colors.hairline),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      Icon(
                        Icons.account_balance_rounded,
                        size: 13,
                        color: colors.inkMuted,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${l10n.paymentProofMethodLabel}: ',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colors.inkMuted,
                        ),
                      ),
                      Text(
                        _paymentMethodLabel(
                          l10n,
                          installment.latestProof!.paymentMethod!,
                        ),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colors.inkStrong,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ],

                // Rejection reason banner
                if (installment.latestProof?.reviewStatus ==
                        PaymentProofStatus.rejected &&
                    installment.latestProof?.rejectionReason != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: colors.error.withValues(alpha: 0.07),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: colors.error.withValues(alpha: 0.18),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.info_outline_rounded,
                          size: 14,
                          color: colors.error,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            l10n.paymentProofRejectionReason(
                              installment.latestProof!.rejectionReason!,
                            ),
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: colors.error,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Submit / Resubmit proof button
                if (installment.canSubmitProof) ...[
                  const SizedBox(height: AppSpacing.md),
                  GestureDetector(
                    onTap: () => context.push(
                      '/account/installments/${installment.id}/submit-proof',
                      extra: installment,
                    ),
                    child: Container(
                      height: 46,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [_navyLight, _navyDeep],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(13),
                        boxShadow: [
                          BoxShadow(
                            color: _navyDeep.withValues(alpha: 0.3),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.receipt_long_outlined,
                            color: AppPalette.gold300,
                            size: 18,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Text(
                            installment.isResubmit
                                ? l10n.paymentProofResubmit
                                : l10n.paymentProofSubmit,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Strip style config ────────────────────────────────────────────────────────

class _StripStyle {
  const _StripStyle({
    required this.colors,
    required this.accentColor,
    required this.icon,
  });
  final List<Color> colors;
  final Color accentColor;
  final IconData icon;
}

// ── Date cell ─────────────────────────────────────────────────────────────────

class _DateCell extends StatelessWidget {
  const _DateCell({
    required this.icon,
    required this.label,
    required this.value,
    this.accent,
  });
  final IconData icon;
  final String label;
  final String value;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final iconColor = accent ?? colors.inkMuted;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 13, color: iconColor),
            const SizedBox(width: 4),
            Text(
              label.replaceAll(':', '').trim(),
              style: theme.textTheme.bodySmall?.copyWith(
                color: colors.inkMuted,
                fontSize: 11,
              ),
            ),
          ],
        ),
        const SizedBox(height: 3),
        Text(
          value,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: colors.inkStrong,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

// ── Filter row ────────────────────────────────────────────────────────────────

class _FilterItem {
  const _FilterItem({required this.key, required this.label});
  final String? key;
  final String label;
}

class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.items,
    required this.selected,
    required this.onSelect,
  });
  final List<_FilterItem> items;
  final String? selected;
  final void Function(String?) onSelect;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, i) {
          final item = items[i];
          final active = item.key == selected;
          return GestureDetector(
            onTap: () => onSelect(item.key),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
              decoration: BoxDecoration(
                gradient: active
                    ? const LinearGradient(
                        colors: [_navyLight, _navyDeep],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                color: active ? null : colors.surface,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: active
                      ? Colors.transparent
                      : colors.hairline.withValues(alpha: 0.6),
                ),
                boxShadow: active
                    ? [
                        BoxShadow(
                          color: _navyDeep.withValues(alpha: 0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ]
                    : null,
              ),
              child: Text(
                item.label,
                style: TextStyle(
                  color: active ? Colors.white : colors.inkStrong,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Dot texture ───────────────────────────────────────────────────────────────

class _DotTexture extends StatelessWidget {
  const _DotTexture();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
