import 'dart:math' as math;

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../installments/domain/entities/installment.dart';
import '../../../installments/presentation/cubit/installments_cubit.dart';
import '../../../maintenance/domain/entities/maintenance_request.dart';
import '../../../maintenance/presentation/maintenance_format.dart';
import '../../../maintenance/presentation/maintenance_requests_cubit.dart';
import '../../../my_property/domain/entities/property.dart';
import '../../../my_property/presentation/my_property_cubit.dart';
import 'customer_home_header.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);

// ─────────────────────────────────────────────────────────────────────────────
// Customer Home Dashboard
// ─────────────────────────────────────────────────────────────────────────────

class CustomerHomeDashboard extends StatelessWidget {
  const CustomerHomeDashboard({super.key, required this.name});

  final String? name;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return BlocBuilder<MyPropertyCubit, MyPropertyState>(
      builder: (context, propertyState) {
        return BlocBuilder<InstallmentsCubit, InstallmentsState>(
          builder: (context, installmentState) {
            final properties = propertyState.data ?? const <Property>[];
            final primary = properties.isNotEmpty ? properties.first : null;

            final allInstallments =
                installmentState.data ?? const <Installment>[];
            final unpaid = allInstallments
                .where((i) => i.status != InstallmentStatus.paid)
                .toList();
            final next = _earliestDue(unpaid);
            final loading = installmentState.status == DataStatus.loading;
            final totalCount = allInstallments.length;
            final paidCount = math.max(0, totalCount - unpaid.length);

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                CustomerHomeHeader(name: name, hasProperty: primary != null),
                const SizedBox(height: AppSpacing.xl),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // 1 · Next payment
                      _PaymentCard(
                        next: next,
                        unpaidCount: unpaid.length,
                        totalCount: totalCount,
                        paidCount: paidCount,
                        loading: loading,
                      ),
                      const SizedBox(height: AppSpacing.xl),

                      // 2 · Owned unit
                      if (primary != null) ...[
                        _SectionRow(
                          title: l10n.homeOwnershipSummary,
                          onViewAll: properties.length > 1
                              ? () => context.push('/account/property')
                              : null,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _PropertyShowcase(property: primary),
                        const SizedBox(height: AppSpacing.xl),
                      ] else ...[
                        _EmptyPropertyCard(),
                        const SizedBox(height: AppSpacing.xl),
                      ],

                      // 3 · Recent service activity
                      const _ActivityTimeline(),
                    ],
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  static Installment? _earliestDue(List<Installment> unpaid) {
    if (unpaid.isEmpty) return null;
    return unpaid.reduce((a, b) => a.dueDate.isBefore(b.dueDate) ? a : b);
  }
}

// ── Section row heading ───────────────────────────────────────────────────────

class _SectionRow extends StatelessWidget {
  const _SectionRow({required this.title, this.onViewAll});

  final String title;
  final VoidCallback? onViewAll;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
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
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              color: colors.inkStrong,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        if (onViewAll != null)
          GestureDetector(
            onTap: onViewAll,
            behavior: HitTestBehavior.opaque,
            child: Text(
              context.l10n.viewAll,
              style: theme.textTheme.labelMedium?.copyWith(
                color: colors.brandGold,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
      ],
    );
  }
}

// ── 1 · Payment card ─────────────────────────────────────────────────────────

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({
    required this.next,
    required this.unpaidCount,
    required this.totalCount,
    required this.paidCount,
    required this.loading,
  });

  final Installment? next;
  final int unpaidCount;
  final int totalCount;
  final int paidCount;
  final bool loading;

  static const _dueSoonDays = 14;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    final hasDue = next != null;
    final overdue = next?.status == InstallmentStatus.overdue;
    final dueSoon = hasDue &&
        !overdue &&
        next!.dueDate.difference(DateTime.now()).inDays <= _dueSoonDays;

    final accentColor = overdue
        ? const Color(0xFFEF4444)
        : dueSoon
            ? const Color(0xFFF59E0B)
            : AppPalette.gold400;

    final progress = totalCount > 0
        ? (paidCount / totalCount).clamp(0.0, 1.0)
        : 0.0;

    return AppSkeletonizer(
      enabled: loading,
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_navyCard, _navyDeep],
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: _navyDeep.withValues(alpha: 0.45),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            const Positioned.fill(
              child: IgnorePointer(child: _CardTexture()),
            ),
            // Start-edge colour rail
            PositionedDirectional(
              start: 0,
              top: 0,
              bottom: 0,
              child: Container(
                width: 4,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      accentColor,
                      accentColor.withValues(alpha: 0.25),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (hasDue) ...[
                    // Label + status badge
                    Row(
                      children: [
                        Text(
                          l10n.homeNextInstallment,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: Colors.white.withValues(alpha: 0.55),
                            letterSpacing: 0.3,
                          ),
                        ),
                        const Spacer(),
                        _StatusPill(
                          label: overdue
                              ? l10n.installmentStatusOverdue
                              : dueSoon
                                  ? l10n.homePaymentDueSoon
                                  : l10n.homePaymentUpcoming,
                          color: accentColor,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    // Amount row + arc
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Text(
                            PriceFormatter.formatString(
                              next!.amount,
                              languageCode: lang,
                            ),
                            style: theme.textTheme.headlineMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              height: 1.0,
                            ),
                          ),
                        ),
                        if (totalCount > 0)
                          _InstallmentArc(
                            paidCount: paidCount,
                            totalCount: totalCount,
                            progress: progress,
                            color: accentColor,
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      _subline(l10n, lang),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.50),
                      ),
                    ),
                  ] else ...[
                    // All clear
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.14),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.verified_rounded,
                            color: Colors.greenAccent,
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l10n.homeNoDuePayments,
                                style: theme.textTheme.titleSmall?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                l10n.homeNoDuePaymentsHint,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.5),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    height: 1,
                    color: Colors.white.withValues(alpha: 0.09),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _GoldCta(
                    label: l10n.homeViewInstallments,
                    icon: AppIcons.installments,
                    onTap: () => context.push('/account/installments'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _subline(AppLocalizations l10n, String lang) {
    final due = l10n.installmentDueOn(
      DateFormatter.mediumDate(next!.dueDate, languageCode: lang),
    );
    if (unpaidCount > 1) {
      return '$due  ·  ${l10n.homeInstallmentsRemaining(unpaidCount)}';
    }
    return due;
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _GoldCta extends StatelessWidget {
  const _GoldCta({
    required this.label,
    required this.icon,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 46,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppPalette.gold300, AppPalette.gold500],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          boxShadow: [
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.35),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: _navyDeep),
            const SizedBox(width: AppSpacing.xs),
            Text(
              label,
              style: const TextStyle(
                color: _navyDeep,
                fontWeight: FontWeight.w800,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Circular arc progress — paid / total installments.
class _InstallmentArc extends StatelessWidget {
  const _InstallmentArc({
    required this.paidCount,
    required this.totalCount,
    required this.progress,
    required this.color,
  });

  final int paidCount;
  final int totalCount;
  final double progress;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      width: 82,
      height: 82,
      child: CustomPaint(
        painter: _ArcPainter(progress: progress, color: color),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$paidCount',
                style: theme.textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  height: 1.0,
                ),
              ),
              Container(
                width: 18,
                height: 1,
                color: Colors.white.withValues(alpha: 0.3),
                margin: const EdgeInsets.symmetric(vertical: 2),
              ),
              Text(
                '$totalCount',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.45),
                  height: 1.0,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ArcPainter extends CustomPainter {
  const _ArcPainter({required this.progress, required this.color});

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 - 5;
    const startAngle = math.pi * 0.75;
    const sweepAngle = math.pi * 1.5;

    // Track
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweepAngle,
      false,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.13)
        ..strokeWidth = 5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );

    // Progress fill
    if (progress > 0.01) {
      final rect = Rect.fromCircle(center: center, radius: radius);
      canvas.drawArc(
        rect,
        startAngle,
        sweepAngle * progress,
        false,
        Paint()
          ..shader = LinearGradient(
            colors: [color.withValues(alpha: 0.75), color],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ).createShader(rect)
          ..strokeWidth = 5
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(_ArcPainter old) =>
      old.progress != progress || old.color != color;
}

// Dot texture for dark cards.
class _CardTexture extends StatelessWidget {
  const _CardTexture();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _CardDotPainter(), child: SizedBox.expand());
}

class _CardDotPainter extends CustomPainter {
  const _CardDotPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = Colors.white.withValues(alpha: 0.03);
    const step = 18.0;
    for (var y = 4.0; y < size.height; y += step) {
      for (var x = 4.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1, p);
      }
    }
  }

  @override
  bool shouldRepaint(_CardDotPainter _) => false;
}

// ── 2 · Property showcase ─────────────────────────────────────────────────────

class _PropertyShowcase extends StatelessWidget {
  const _PropertyShowcase({required this.property});
  final Property property;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final owned = property.status == PropertyStatus.owned;

    final stats = <_Stat>[
      if (property.contractNumber != null)
        _Stat(l10n.myPropertyContractNumber, property.contractNumber!),
      if (property.signedAt != null)
        _Stat(
          l10n.myPropertySignedDate,
          DateFormatter.mediumDate(property.signedAt!, languageCode: lang),
        ),
      if (property.hasInstallmentPlan)
        _Stat(
          l10n.homeMonthlyInstallment,
          PriceFormatter.formatString(
            property.monthlyAmount,
            languageCode: lang,
          ),
        ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Navy banner header
          GestureDetector(
            onTap: () => context.push('/account/property'),
            child: _PropertyBanner(
              projectName: property.projectName.resolve(lang),
              unitType: property.unitType,
              unitCode: property.unitCode,
              owned: owned,
              l10n: l10n,
            ),
          ),
          // Contract stats
          if (stats.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.xs,
              ),
              child: Column(
                children: [
                  for (var i = 0; i < stats.length; i++) ...[
                    if (i > 0) Divider(height: 1, color: colors.hairline),
                    _StatLine(stat: stats[i]),
                  ],
                ],
              ),
            ),
          Divider(height: 1, color: colors.hairline),
          // Action tiles 2×2
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _ActionTile(
                        icon: AppIcons.installments,
                        label: l10n.homeViewInstallments,
                        onTap: () =>
                            context.push('/account/installments'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: _ActionTile(
                        icon: AppIcons.deposit,
                        label: l10n.accountDeposits,
                        onTap: () => context.push('/account/deposits'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: _ActionTile(
                        icon: AppIcons.contract,
                        label: l10n.homeViewContractPdf,
                        onTap: () =>
                            context.push('/account/contracts'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: _ActionTile(
                        icon: AppIcons.maintenance,
                        label: l10n.myPropertyRequestMaintenance,
                        onTap: () => context.push(
                          '/account/maintenance/new',
                          extra: {'unitId': property.unitId},
                        ),
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

class _PropertyBanner extends StatelessWidget {
  const _PropertyBanner({
    required this.projectName,
    required this.unitType,
    required this.unitCode,
    required this.owned,
    required this.l10n,
  });

  final String projectName;
  final String unitType;
  final String unitCode;
  final bool owned;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_navyCard, _navyDeep],
        ),
      ),
      child: Row(
        children: [
          // Gold-tinted home icon tile
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppPalette.gold400.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppPalette.gold400.withValues(alpha: 0.32),
              ),
            ),
            child: const Icon(
              Icons.home_rounded,
              color: AppPalette.gold400,
              size: 26,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  projectName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$unitType · $unitCode',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.55),
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          // Owned / reserved badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: owned
                  ? Colors.green.withValues(alpha: 0.14)
                  : Colors.amber.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: owned
                    ? Colors.greenAccent.withValues(alpha: 0.45)
                    : Colors.amber.withValues(alpha: 0.45),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: owned ? Colors.greenAccent : Colors.amber,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  owned
                      ? l10n.myPropertyStatusOwned
                      : l10n.myPropertyStatusReserved,
                  style: TextStyle(
                    color: owned ? Colors.greenAccent : Colors.amber,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
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

class _Stat {
  const _Stat(this.label, this.value);
  final String label;
  final String value;
}

class _StatLine extends StatelessWidget {
  const _StatLine({required this.stat});
  final _Stat stat;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Text(
            stat.label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: colors.inkMuted,
            ),
          ),
          const Spacer(),
          Text(
            stat.value,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colors.inkStrong,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Material(
      color: colors.surfaceSoft,
      borderRadius: BorderRadius.circular(AppRadii.md),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.sm + 2,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.md),
            border: Border.all(color: colors.hairline, width: 0.75),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppPalette.gold400.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: AppPalette.gold500),
              ),
              const SizedBox(width: AppSpacing.xs),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Empty property prompt ────────────────────────────────────────────────────

class _EmptyPropertyCard extends StatelessWidget {
  const _EmptyPropertyCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    return PremiumCard(
      glow: true,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconChip(
            icon: AppIcons.property,
            tone: AppTone.gold,
            size: IconChipSize.lg,
            filled: true,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            l10n.homeOwnerEmptyTitle,
            style: theme.textTheme.titleMedium?.copyWith(
              color: colors.inkStrong,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            l10n.homeOwnerEmptyMessage,
            style: theme.textTheme.bodySmall?.copyWith(
              color: colors.inkMuted,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: AppButton(
              label: l10n.homeExploreProjects,
              icon: AppIcons.property,
              variant: AppButtonVariant.primary,
              size: AppButtonSize.medium,
              onPressed: () => context.go('/projects'),
            ),
          ),
        ],
      ),
    );
  }
}

// ── 3 · Activity timeline ────────────────────────────────────────────────────

class _ActivityTimeline extends StatelessWidget {
  const _ActivityTimeline();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return BlocBuilder<MaintenanceRequestsCubit, MaintenanceRequestsState>(
      builder: (context, state) {
        final requests = state.data ?? const <MaintenanceRequest>[];
        if (requests.isEmpty) return const SizedBox.shrink();
        final recent = requests.take(3).toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SectionRow(
              title: l10n.homeRecentActivity,
              onViewAll: () => context.push('/account/maintenance'),
            ),
            const SizedBox(height: AppSpacing.md),
            Container(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: colors.hairline.withValues(alpha: 0.6),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 12,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (var i = 0; i < recent.length; i++)
                    _TimelineItem(
                      request: recent[i],
                      isLast: i == recent.length - 1,
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _TimelineItem extends StatelessWidget {
  const _TimelineItem({required this.request, required this.isLast});

  final MaintenanceRequest request;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final title = request.categoryName?.resolve(lang).trim();

    return InkWell(
      onTap: () => context.push(
        '/account/maintenance/${request.id}',
        extra: request,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.xs,
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Timeline column
              SizedBox(
                width: 36,
                child: Column(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppPalette.navy.withValues(alpha: 0.07),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: colors.hairline.withValues(alpha: 0.8),
                          width: 0.75,
                        ),
                      ),
                      child: Icon(
                        AppIcons.maintenance,
                        size: 17,
                        color: AppPalette.navy.withValues(alpha: 0.55),
                      ),
                    ),
                    if (!isLast)
                      Expanded(
                        child: Container(
                          width: 2,
                          margin: const EdgeInsets.only(top: 4),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                AppPalette.gold400.withValues(alpha: 0.35),
                                AppPalette.gold400.withValues(alpha: 0.0),
                              ],
                            ),
                            borderRadius: BorderRadius.circular(1),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              // Content
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    top: 6,
                    bottom: isLast ? 6 : AppSpacing.md,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              (title != null && title.isNotEmpty)
                                  ? title
                                  : request.description,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.titleSmall?.copyWith(
                                color: colors.inkStrong,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            if (request.createdAt != null) ...[
                              const SizedBox(height: 3),
                              Text(
                                DateFormatter.mediumDate(
                                  request.createdAt!,
                                  languageCode: lang,
                                ),
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: colors.inkMuted,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      StatusBadge(
                        label: maintenanceStatusLabel(l10n, request.status),
                        tone: maintenanceStatusTone(request.status),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
