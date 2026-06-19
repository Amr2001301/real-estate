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

const _navy = Color(0xFF0B1726);
const _navyCard = Color(0xFF152236);
const _navyAccent = Color(0xFF1E3451);

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
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // 1 · Next installment
                      _InstallmentCard(
                        next: next,
                        unpaidCount: unpaid.length,
                        totalCount: totalCount,
                        paidCount: paidCount,
                        loading: loading,
                      ),
                      const SizedBox(height: AppSpacing.xl),

                      // 2 · Property
                      if (primary != null) ...[
                        _SectionHeader(
                          icon: Icons.home_work_rounded,
                          title: l10n.homeOwnershipSummary,
                          onViewAll: properties.length > 1
                              ? () => context.push('/account/property')
                              : null,
                          viewAllLabel: l10n.viewAll,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _PropertyCard(property: primary),
                        const SizedBox(height: AppSpacing.xl),
                      ] else ...[
                        _EmptyPropertyCard(),
                        const SizedBox(height: AppSpacing.xl),
                      ],

                      // 3 · Recent activity
                      const _ActivityFeed(),
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

// ── Premium section header ────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.title,
    this.onViewAll,
    this.viewAllLabel,
  });

  final IconData icon;
  final String title;
  final VoidCallback? onViewAll;
  final String? viewAllLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [_navyAccent, _navy],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 17, color: AppPalette.gold300),
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
              viewAllLabel ?? '',
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

// ── 1 · Installment card ──────────────────────────────────────────────────────

class _InstallmentCard extends StatelessWidget {
  const _InstallmentCard({
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
    final isRtl = Directionality.of(context) == TextDirection.rtl;

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
            colors: [_navyAccent, _navyCard, _navy],
            stops: [0.0, 0.5, 1.0],
          ),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: _navy.withValues(alpha: 0.50),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
            if (overdue)
              BoxShadow(
                color: const Color(0xFFEF4444).withValues(alpha: 0.22),
                blurRadius: 32,
                spreadRadius: 2,
              ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            const Positioned.fill(
              child: IgnorePointer(child: _CardTexture()),
            ),
            // Status-tinted radial glow
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 180,
                height: 160,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      accentColor.withValues(alpha: 0.14),
                      accentColor.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            // Accent rail at card start edge
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
                      accentColor.withValues(alpha: 0.2),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.md,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (hasDue) ...[
                    // Top row: label + status pill
                    Row(
                      children: [
                        Text(
                          l10n.homeNextInstallment,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: Colors.white.withValues(alpha: 0.50),
                            letterSpacing: 0.4,
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
                    const SizedBox(height: AppSpacing.md),
                    // Amount + donut ring
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                PriceFormatter.formatString(
                                  next!.amount,
                                  languageCode: lang,
                                ),
                                style: theme.textTheme.headlineLarge?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  height: 1.0,
                                  letterSpacing: -1.0,
                                  shadows: [
                                    Shadow(
                                      color:
                                          accentColor.withValues(alpha: 0.4),
                                      blurRadius: 16,
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    AppIcons.calendar,
                                    size: 12,
                                    color: Colors.white.withValues(alpha: 0.42),
                                  ),
                                  const SizedBox(width: 5),
                                  Flexible(
                                    child: Text(
                                      _subline(l10n, lang),
                                      style: theme.textTheme.bodySmall
                                          ?.copyWith(
                                            color: Colors.white
                                                .withValues(alpha: 0.48),
                                          ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        if (totalCount > 0)
                          _DonutRing(
                            paidCount: paidCount,
                            totalCount: totalCount,
                            progress: progress,
                            color: accentColor,
                          ),
                      ],
                    ),
                  ] else ...[
                    // All clear state
                    Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                const Color(0xFF10B981).withValues(alpha: 0.26),
                                const Color(0xFF10B981).withValues(alpha: 0.10),
                              ],
                            ),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color:
                                  const Color(0xFF34D399).withValues(alpha: 0.45),
                            ),
                          ),
                          child: const Icon(
                            Icons.verified_rounded,
                            color: Color(0xFF34D399),
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
                              const SizedBox(height: 3),
                              Text(
                                l10n.homeNoDuePaymentsHint,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.50),
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
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.white.withValues(alpha: 0.0),
                          Colors.white.withValues(alpha: 0.10),
                          Colors.white.withValues(alpha: 0.0),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _GoldAction(
                    label: l10n.homeViewInstallments,
                    icon: AppIcons.installments,
                    isRtl: isRtl,
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.50)),
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

class _GoldAction extends StatelessWidget {
  const _GoldAction({
    required this.label,
    required this.icon,
    required this.isRtl,
    required this.onTap,
  });
  final String label;
  final IconData icon;
  final bool isRtl;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [
              Color(0xFFD4A843),
              AppPalette.gold300,
              AppPalette.gold500,
              Color(0xFFB8892C),
            ],
            stops: [0.0, 0.35, 0.65, 1.0],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          boxShadow: [
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.40),
              blurRadius: 16,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: _navy),
            const SizedBox(width: AppSpacing.xs),
            Text(
              label,
              style: const TextStyle(
                color: _navy,
                fontWeight: FontWeight.w800,
                fontSize: 14,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              isRtl
                  ? Icons.chevron_left_rounded
                  : Icons.chevron_right_rounded,
              size: 16,
              color: _navy.withValues(alpha: 0.55),
            ),
          ],
        ),
      ),
    );
  }
}

// Full-circle donut ring
class _DonutRing extends StatelessWidget {
  const _DonutRing({
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
      width: 86,
      height: 86,
      child: CustomPaint(
        painter: _DonutPainter(progress: progress, color: color),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$paidCount',
                style: theme.textTheme.titleLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  height: 1.0,
                ),
              ),
              Container(
                width: 20,
                height: 1,
                color: Colors.white.withValues(alpha: 0.28),
                margin: const EdgeInsets.symmetric(vertical: 2),
              ),
              Text(
                '$totalCount',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.40),
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

class _DonutPainter extends CustomPainter {
  const _DonutPainter({required this.progress, required this.color});

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 - 6;
    const startAngle = -math.pi / 2; // Start at top

    // Track (full circle)
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      math.pi * 2,
      false,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.10)
        ..strokeWidth = 6
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );

    if (progress > 0.01) {
      final rect = Rect.fromCircle(center: center, radius: radius);

      // Glow halo
      canvas.drawArc(
        rect,
        startAngle,
        math.pi * 2 * progress,
        false,
        Paint()
          ..color = color.withValues(alpha: 0.28)
          ..strokeWidth = 12
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
      );

      // Solid fill
      canvas.drawArc(
        rect,
        startAngle,
        math.pi * 2 * progress,
        false,
        Paint()
          ..shader = LinearGradient(
            colors: [color.withValues(alpha: 0.80), color],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ).createShader(rect)
          ..strokeWidth = 6
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) =>
      old.progress != progress || old.color != color;
}

// ── Dot texture ───────────────────────────────────────────────────────────────

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

// ── 2 · Property card ─────────────────────────────────────────────────────────

class _PropertyCard extends StatelessWidget {
  const _PropertyCard({required this.property});
  final Property property;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final owned = property.status == PropertyStatus.owned;

    final stats = <({IconData icon, String label, String value})>[
      if (property.contractNumber != null)
        (
          icon: AppIcons.contract,
          label: l10n.myPropertyContractNumber,
          value: property.contractNumber!,
        ),
      if (property.signedAt != null)
        (
          icon: AppIcons.calendar,
          label: l10n.myPropertySignedDate,
          value: DateFormatter.mediumDate(
            property.signedAt!,
            languageCode: lang,
          ),
        ),
      if (property.hasInstallmentPlan)
        (
          icon: AppIcons.installments,
          label: l10n.homeMonthlyInstallment,
          value: PriceFormatter.formatString(
            property.monthlyAmount,
            languageCode: lang,
          ),
        ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
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
          // Premium banner
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
          // Stats with icons
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
                    _StatRow(
                      icon: stats[i].icon,
                      label: stats[i].label,
                      value: stats[i].value,
                    ),
                  ],
                ],
              ),
            ),
          Divider(height: 1, color: colors.hairline),
          // Horizontal action strip
          _ActionStrip(unitId: property.unitId),
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
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_navyAccent, _navy],
        ),
      ),
      child: Stack(
        children: [
          const Positioned.fill(
            child: IgnorePointer(child: _CardTexture()),
          ),
          PositionedDirectional(
            end: 0,
            top: 0,
            child: Container(
              width: 120,
              height: 100,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.14),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              children: [
                // Large icon tile
                Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppPalette.gold400.withValues(alpha: 0.22),
                        AppPalette.gold400.withValues(alpha: 0.08),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: AppPalette.gold400.withValues(alpha: 0.40),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppPalette.gold400.withValues(alpha: 0.15),
                        blurRadius: 10,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.home_rounded,
                    color: AppPalette.gold300,
                    size: 28,
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
                          color: Colors.white.withValues(alpha: 0.52),
                          letterSpacing: 0.2,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                // Status badge
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: owned
                        ? const Color(0xFF10B981).withValues(alpha: 0.16)
                        : Colors.amber.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: owned
                          ? const Color(0xFF34D399).withValues(alpha: 0.50)
                          : Colors.amber.withValues(alpha: 0.50),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: owned
                              ? const Color(0xFF34D399)
                              : Colors.amber,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        owned
                            ? l10n.myPropertyStatusOwned
                            : l10n.myPropertyStatusReserved,
                        style: TextStyle(
                          color: owned
                              ? const Color(0xFF34D399)
                              : Colors.amber,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
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

class _StatRow extends StatelessWidget {
  const _StatRow({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Icon(icon, size: 15, color: colors.inkMuted),
          const SizedBox(width: AppSpacing.sm),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
          ),
          const Spacer(),
          Text(
            value,
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

// Horizontal scrollable action strip
class _ActionStrip extends StatelessWidget {
  const _ActionStrip({required this.unitId});
  final String unitId;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    final actions = <({IconData icon, String label, VoidCallback onTap})>[
      (
        icon: AppIcons.installments,
        label: l10n.homeViewInstallments,
        onTap: () => context.push('/account/installments'),
      ),
      (
        icon: AppIcons.deposit,
        label: l10n.accountDeposits,
        onTap: () => context.push('/account/deposits'),
      ),
      (
        icon: AppIcons.contract,
        label: l10n.homeViewContractPdf,
        onTap: () => context.push('/account/contracts'),
      ),
      (
        icon: AppIcons.maintenance,
        label: l10n.myPropertyRequestMaintenance,
        onTap: () => context.push(
          '/account/maintenance/new',
          extra: {'unitId': unitId},
        ),
      ),
    ];

    return SizedBox(
      height: 90,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        itemCount: actions.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.xs),
        itemBuilder: (context, i) => _ActionChip(
          icon: actions[i].icon,
          label: actions[i].label,
          onTap: actions[i].onTap,
        ),
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({
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
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          width: 84,
          decoration: BoxDecoration(
            color: colors.surfaceSoft,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: colors.hairline.withValues(alpha: 0.6),
              width: 0.75,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [_navyAccent, _navy],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 16, color: AppPalette.gold300),
              ),
              const SizedBox(height: 5),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w700,
                  fontSize: 9.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Empty property prompt ─────────────────────────────────────────────────────

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
            style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
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

// ── 3 · Activity feed ─────────────────────────────────────────────────────────

class _ActivityFeed extends StatelessWidget {
  const _ActivityFeed();

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
            _SectionHeader(
              icon: AppIcons.maintenance,
              title: l10n.homeRecentActivity,
              onViewAll: () => context.push('/account/maintenance'),
              viewAllLabel: l10n.viewAll,
            ),
            const SizedBox(height: AppSpacing.md),
            Container(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: colors.hairline.withValues(alpha: 0.5),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (var i = 0; i < recent.length; i++)
                    _FeedItem(
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

class _FeedItem extends StatelessWidget {
  const _FeedItem({required this.request, required this.isLast});

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
              // Timeline column with gradient icon box
              SizedBox(
                width: 36,
                child: Column(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [_navyAccent, _navy],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        AppIcons.maintenance,
                        size: 17,
                        color: AppPalette.gold300,
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
                                AppPalette.gold400.withValues(alpha: 0.40),
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
