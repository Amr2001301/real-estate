import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../home_summary/domain/entities/home_summary.dart';
import '../../../home_summary/presentation/home_summary_cubit.dart';
import '../../../maintenance/presentation/maintenance_format.dart';
import '../../../notifications/presentation/unread_count_cubit.dart';
import 'customer_home_header.dart';

const _navy = Color(0xFF0B1726);
const _navyCard = Color(0xFF152236);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

class CustomerHomeDashboard extends StatelessWidget {
  const CustomerHomeDashboard({super.key, required this.name});
  final String? name;

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<HomeSummaryCubit, HomeSummaryState>(
      listener: (context, state) {
        if (state.isSuccess && state.data != null) {
          context
              .read<UnreadCountCubit>()
              .setCount(state.data!.notifications.unreadCount);
        }
      },
      builder: (context, state) {
        final summary = state.data;
        final loading = state.status == DataStatus.initial || state.isLoading;
        final displayName =
            (summary?.profile.displayName.isNotEmpty == true)
                ? summary!.profile.displayName
                : name;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CustomerHomeHeader(
              name: displayName,
              hasProperty: summary?.profile.isOwner ?? false,
            ),
            const SizedBox(height: AppSpacing.md),
            if (loading)
              const _Skeleton()
            else if (state.status == DataStatus.failure)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: ErrorState(
                  failure: state.failure,
                  onRetry: () => context.read<HomeSummaryCubit>().load(),
                ),
              )
            else if (summary != null)
              _Body(summary: summary),
          ],
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Body
// ─────────────────────────────────────────────────────────────────────────────

class _Body extends StatelessWidget {
  const _Body({required this.summary});
  final HomeSummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1 · Action card
          _ActionCard(action: summary.primaryAction),
          const SizedBox(height: AppSpacing.md),

          // 2 · Property section header
          _SectionRow(
            icon: AppIcons.property,
            title: l10n.homeOwnershipSummary,
            trailing: summary.profile.ownedUnitsCount > 1
                ? _Link(
                    label: 'عرض كل وحداتي',
                    onTap: () => context.push('/account/property'),
                  )
                : null,
          ),
          const SizedBox(height: AppSpacing.xs),

          // 2b · Property unit: card + quick actions footer as one visual block
          if (summary.primaryProperty != null)
            _PropertyUnit(
              property: summary.primaryProperty!,
              unitId: summary.primaryProperty?.unitId,
              lang: lang,
              l10n: l10n,
            )
          else
            _EmptyProperty(),
          const SizedBox(height: AppSpacing.md),

          // 3 · Financial snapshot
          _SectionRow(
            icon: AppIcons.installments,
            title: l10n.installmentsTitle,
            trailing: _Link(
              label: l10n.homeViewInstallments,
              onTap: () => context.push('/account/installments'),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          _FinancialCard(installments: summary.installments),
          const SizedBox(height: AppSpacing.md),

          // 4 · Maintenance
          _SectionRow(
            icon: AppIcons.maintenance,
            title: l10n.homeRecentActivity,
            countBadge: summary.maintenance.openCount > 0
                ? summary.maintenance.openCount
                : null,
            trailing: summary.maintenance.recentRequests.isNotEmpty
                ? _Link(
                    label: l10n.viewAll,
                    onTap: () => context.push('/account/maintenance'),
                  )
                : null,
          ),
          const SizedBox(height: AppSpacing.xs),
          _MaintenanceCard(maintenance: summary.maintenance),
          // No bottom SizedBox here.
          // home_screen.dart's ListView already carries sufficient bottom
          // padding (safeArea + navHeight + 104px) to clear the floating nav.
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section row
// ─────────────────────────────────────────────────────────────────────────────

class _SectionRow extends StatelessWidget {
  const _SectionRow({
    required this.icon,
    required this.title,
    this.trailing,
    this.countBadge,
  });

  final IconData icon;
  final String title;
  final Widget? trailing;
  final int? countBadge;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [_navyLight, _navy],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 14, color: AppPalette.gold300),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Row(
            children: [
              Text(
                title,
                style: theme.textTheme.titleSmall?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (countBadge != null) ...[
                const SizedBox(width: 5),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: colors.error.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '$countBadge',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: colors.error,
                      fontWeight: FontWeight.w800,
                      fontSize: 10,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        // ignore: use_null_aware_elements
        if (trailing != null) trailing!,
      ],
    );
  }
}

class _Link extends StatelessWidget {
  const _Link({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsetsDirectional.only(start: AppSpacing.sm),
        child: Text(
          label,
          style: TextStyle(
            color: context.appColors.brandGold,
            fontWeight: FontWeight.w700,
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 · Primary action card
// ─────────────────────────────────────────────────────────────────────────────

class _ActionCard extends StatelessWidget {
  const _ActionCard({required this.action});
  final HomeSummaryPrimaryAction action;

  static Color _accent(String severity) => switch (severity) {
        'danger' => const Color(0xFFEF4444),
        'warning' => const Color(0xFFF59E0B),
        'success' => const Color(0xFF10B981),
        'info' => const Color(0xFF60A5FA),
        _ => AppPalette.gold400,
      };

  IconData _icon() => switch (action.type) {
        'OVERDUE_INSTALLMENT' => Icons.warning_amber_rounded,
        'DUE_SOON_INSTALLMENT' => Icons.event_rounded,
        'MAINTENANCE_UPDATE' => AppIcons.maintenance,
        'UPCOMING_INSTALLMENT' => AppIcons.installments,
        _ => Icons.check_circle_rounded,
      };

  String _pillLabel(AppLocalizations l10n) => switch (action.type) {
        'OVERDUE_INSTALLMENT' => l10n.installmentStatusOverdue,
        'DUE_SOON_INSTALLMENT' => l10n.homePaymentDueSoon,
        'MAINTENANCE_UPDATE' => l10n.homeRecentActivity,
        'UPCOMING_INSTALLMENT' => l10n.homePaymentUpcoming,
        _ => l10n.homeNoDuePayments,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);
    final accent = _accent(action.severity);
    final title = action.title.resolve(lang);
    final subtitle = action.subtitle.resolve(lang);
    final hasAmount = action.amount?.isNotEmpty == true;

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_navyLight, _navyCard, _navy],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          stops: [0.0, 0.45, 1.0],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: _navy.withValues(alpha: 0.50),
            blurRadius: 22,
            offset: const Offset(0, 7),
          ),
          BoxShadow(
            color: accent.withValues(alpha: 0.16),
            blurRadius: 24,
            spreadRadius: 1,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          const Positioned.fill(child: IgnorePointer(child: _Dots())),
          PositionedDirectional(
            start: 0,
            top: 0,
            bottom: 0,
            child: Container(
              width: 3,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [accent, accent.withValues(alpha: 0.12)],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.lg,
              AppSpacing.sm + 2,
              AppSpacing.md,
              AppSpacing.sm + 2,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    _StatusPill(accent: accent, label: _pillLabel(l10n)),
                    const Spacer(),
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(9),
                        border: Border.all(
                          color: accent.withValues(alpha: 0.28),
                        ),
                      ),
                      child: Icon(_icon(), size: 17, color: accent),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                if (title.isNotEmpty)
                  Text(
                    title,
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.52),
                      height: 1.35,
                      fontSize: 11.5,
                    ),
                  ),
                ],
                // Amount: FittedBox guarantees no truncation or ellipsis.
                if (hasAmount) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: AlignmentDirectional.centerStart,
                          child: Text(
                            PriceFormatter.formatString(
                              action.amount!,
                              languageCode: lang,
                            ),
                            style: theme.textTheme.headlineSmall?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              height: 1.0,
                              letterSpacing: -0.4,
                            ),
                          ),
                        ),
                      ),
                      if (action.dueDate != null)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(
                            start: AppSpacing.xs,
                            bottom: 2,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                AppIcons.calendar,
                                size: 10,
                                color: Colors.white.withValues(alpha: 0.32),
                              ),
                              const SizedBox(width: 3),
                              Text(
                                DateFormatter.mediumDate(
                                  action.dueDate!,
                                  languageCode: lang,
                                ),
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.38),
                                  fontSize: 10.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                _CtaButton(
                  label: l10n.homeViewInstallments,
                  onTap: () => context.push('/account/installments'),
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
  const _StatusPill({required this.accent, required this.label});
  final Color accent;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: accent.withValues(alpha: 0.36)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: accent,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _CtaButton extends StatelessWidget {
  const _CtaButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppPalette.gold300, AppPalette.gold500],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          boxShadow: [
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.32),
              blurRadius: 12,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: _navy,
            fontWeight: FontWeight.w800,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Property unit: card + quick actions footer as ONE container.
//     The footer is attached directly to the card — no detached grid, no gap.
//     Total visible height on first render is ≈ 280–300px so the full unit
//     fits in the first viewport alongside Header + ActionCard.
// ─────────────────────────────────────────────────────────────────────────────

class _PropertyUnit extends StatelessWidget {
  const _PropertyUnit({
    required this.property,
    required this.unitId,
    required this.lang,
    required this.l10n,
  });

  final HomeSummaryPrimaryProperty property;
  final String? unitId;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final owned = property.isOwned;

    final stats = <_Stat>[
      if (property.contractNumber != null)
        _Stat(l10n.myPropertyContractNumber, property.contractNumber!),
      if (property.signedAt != null)
        _Stat(
          l10n.myPropertySignedDate,
          DateFormatter.mediumDate(
            property.signedAt!,
            languageCode: lang,
          ),
        ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 5),
          ),
          if (owned)
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.07),
              blurRadius: 26,
              spreadRadius: 2,
            ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Navy header — tap navigates to property detail
          InkWell(
            onTap: () => context.push('/account/property'),
            child: _CardHeader(
              projectName: property.projectName.resolve(lang),
              unitType: property.unitType,
              unitCode: property.unitCode,
              city: property.city,
              owned: owned,
              l10n: l10n,
            ),
          ),
          if (stats.isNotEmpty) _StatsBlock(stats: stats, colors: colors),
          if (property.hasInstallmentPlan &&
              property.monthlyAmount != null &&
              property.totalMonths != null)
            _PlanBanner(
              monthlyAmount: property.monthlyAmount!,
              totalMonths: property.totalMonths!,
              lang: lang,
              l10n: l10n,
            ),
          // Quick actions footer — 4 items in a horizontal row.
          // Separated from card body by a hairline; same border-radius clip.
          _QuickActionsFooter(unitId: unitId, l10n: l10n, colors: colors),
        ],
      ),
    );
  }
}

class _CardHeader extends StatelessWidget {
  const _CardHeader({
    required this.projectName,
    required this.unitType,
    required this.unitCode,
    required this.city,
    required this.owned,
    required this.l10n,
  });

  final String projectName;
  final String unitType;
  final String unitCode;
  final String city;
  final bool owned;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final dotColor = owned ? Colors.greenAccent : Colors.amber;
    return SizedBox(
      height: 108,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_navyLight, _navyCard, _navy],
                stops: [0.0, 0.48, 1.0],
              ),
            ),
          ),
          const IgnorePointer(child: _Dots()),
          PositionedDirectional(
            end: 52,
            top: 8,
            bottom: 8,
            child: Icon(
              Icons.domain_rounded,
              size: 64,
              color: Colors.white.withValues(alpha: 0.045),
            ),
          ),
          Positioned(
            bottom: 0,
            left: 32,
            right: 32,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.0),
                    AppPalette.gold400.withValues(alpha: 0.50),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.md,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppPalette.gold400.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AppPalette.gold400.withValues(alpha: 0.35),
                    ),
                  ),
                  child: const Icon(
                    Icons.domain_rounded,
                    color: AppPalette.gold400,
                    size: 26,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        projectName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        city.isNotEmpty
                            ? '$unitType · $unitCode · $city'
                            : '$unitType · $unitCode',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.55),
                          fontSize: 12,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: (owned ? Colors.green : Colors.amber).withValues(
                      alpha: 0.14,
                    ),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: dotColor.withValues(alpha: 0.45),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: dotColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        owned
                            ? l10n.myPropertyStatusOwned
                            : l10n.myPropertyStatusReserved,
                        style: TextStyle(
                          color: dotColor,
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

class _Stat {
  const _Stat(this.label, this.value);
  final String label;
  final String value;
}

class _StatsBlock extends StatelessWidget {
  const _StatsBlock({required this.stats, required this.colors});
  final List<_Stat> stats;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xs,
      ),
      child: Column(
        children: [
          for (var i = 0; i < stats.length; i++) ...[
            if (i > 0) Divider(height: 1, color: colors.hairline),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: Row(
                children: [
                  Text(
                    stats[i].label,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colors.inkMuted,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    stats[i].value,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// Plan banner: amount and months stacked in a Column so neither can be
// compressed by a sibling Expanded — no maxLines, no overflow, no ellipsis.
class _PlanBanner extends StatelessWidget {
  const _PlanBanner({
    required this.monthlyAmount,
    required this.totalMonths,
    required this.lang,
    required this.l10n,
  });

  final String monthlyAmount;
  final int totalMonths;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final formatted = PriceFormatter.formatString(
      monthlyAmount,
      languageCode: lang,
    );
    return Container(
      margin: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        0,
        AppSpacing.lg,
        AppSpacing.sm,
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppPalette.gold400.withValues(alpha: 0.09),
            AppPalette.gold400.withValues(alpha: 0.04),
          ],
          begin: Alignment.centerRight,
          end: Alignment.centerLeft,
        ),
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.28),
          width: 0.75,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: AppPalette.gold400.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(7),
            ),
            child: const Icon(
              Icons.calendar_month_rounded,
              size: 13,
              color: AppPalette.gold500,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              l10n.myPropertyInstallmentPlan,
              style: TextStyle(
                color: AppPalette.gold500.withValues(alpha: 0.80),
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          // Amount on its own line; months below it.
          // Column here means neither text is constrained by a sibling.
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                formatted,
                style: const TextStyle(
                  color: AppPalette.gold500,
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  height: 1.1,
                ),
              ),
              Text(
                '/ شهرًا · $totalMonths شهرًا',
                style: TextStyle(
                  color: AppPalette.gold500.withValues(alpha: 0.65),
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  height: 1.2,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick actions footer — horizontal 4-column row attached to the property card.
// 64px tall, separated by a hairline from the card body above.
// ─────────────────────────────────────────────────────────────────────────────

class _QuickActionsFooter extends StatelessWidget {
  const _QuickActionsFooter({
    required this.unitId,
    required this.l10n,
    required this.colors,
  });

  final String? unitId;
  final AppLocalizations l10n;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    final items = [
      (
        icon: AppIcons.installments,
        label: l10n.homeViewInstallments,
        onTap: () => context.push('/account/installments'),
        highlight: false,
      ),
      (
        icon: AppIcons.deposit,
        label: l10n.accountDeposits,
        onTap: () => context.push('/account/deposits'),
        highlight: false,
      ),
      (
        icon: AppIcons.contract,
        label: l10n.homeViewContractPdf,
        onTap: () => context.push('/account/contracts'),
        highlight: false,
      ),
      (
        icon: AppIcons.maintenance,
        label: l10n.myPropertyRequestMaintenance,
        onTap: () => context.push(
          '/account/maintenance/new',
          extra: (unitId != null && unitId!.isNotEmpty)
              ? {'unitId': unitId} as Object?
              : null as Object?,
        ),
        highlight: true,
      ),
    ];

    return Container(
      height: 64,
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: colors.hairline.withValues(alpha: 0.60)),
        ),
      ),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0)
              SizedBox(
                width: 1,
                height: 64,
                child: ColoredBox(
                  color: colors.hairline.withValues(alpha: 0.60),
                ),
              ),
            _QItem(
              icon: items[i].icon,
              label: items[i].label,
              highlight: items[i].highlight,
              onTap: items[i].onTap,
              colors: colors,
            ),
          ],
        ],
      ),
    );
  }
}

class _QItem extends StatelessWidget {
  const _QItem({
    required this.icon,
    required this.label,
    required this.highlight,
    required this.onTap,
    required this.colors,
  });

  final IconData icon;
  final String label;
  final bool highlight;
  final VoidCallback onTap;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: Material(
        color: highlight ? _navy : colors.surface,
        child: InkWell(
          onTap: onTap,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 18,
                color: highlight
                    ? AppPalette.gold300
                    : _navy.withValues(alpha: 0.65),
              ),
              const SizedBox(height: 3),
              Text(
                label,
                maxLines: 2,
                textAlign: TextAlign.center,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: highlight ? Colors.white : colors.inkMuted,
                  fontSize: 9.5,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty property state
// ─────────────────────────────────────────────────────────────────────────────

class _EmptyProperty extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_navyLight, _navy],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(13),
            ),
            child: const Icon(
              Icons.home_work_outlined,
              color: AppPalette.gold300,
              size: 22,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.homeOwnerEmptyTitle,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  l10n.homeOwnerEmptyMessage,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: colors.inkMuted),
                  maxLines: 2,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          GestureDetector(
            onTap: () => context.go('/projects'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppPalette.gold300, AppPalette.gold500],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
              child: Text(
                l10n.homeExploreProjects,
                style: const TextStyle(
                  color: _navy,
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Financial snapshot — light white card, secondary to the action card
// ─────────────────────────────────────────────────────────────────────────────

class _FinancialCard extends StatelessWidget {
  const _FinancialCard({required this.installments});
  final HomeSummaryInstallments installments;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);
    final colors = context.appColors;
    final nextDue = installments.nextDue;
    final hasData = installments.totalCount > 0 || nextDue != null;

    if (!hasData) {
      return _FinancialEmpty(l10n: l10n, theme: theme, colors: colors);
    }

    final progress = installments.totalCount > 0
        ? (installments.paidCount / installments.totalCount).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Next-due header — light tint, not a heavy dark strip
          Container(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.sm + 2,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            color: AppPalette.gold400.withValues(alpha: 0.05),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        l10n.homeNextInstallment,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: colors.inkMuted,
                          fontSize: 11,
                        ),
                      ),
                      const SizedBox(height: 3),
                      // Amount: inside Expanded column — unlimited horizontal
                      // space, no maxLines, no overflow → never truncated.
                      if (nextDue != null)
                        Text(
                          PriceFormatter.formatString(
                            nextDue.amount,
                            languageCode: lang,
                          ),
                          style: TextStyle(
                            color: nextDue.isOverdue
                                ? const Color(0xFFEF4444)
                                : colors.inkStrong,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.3,
                            height: 1.05,
                          ),
                        )
                      else
                        Text(
                          l10n.homeNoDuePayments,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: colors.inkStrong,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      if (nextDue != null) ...[
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Icon(
                              AppIcons.calendar,
                              size: 10,
                              color: colors.inkMuted,
                            ),
                            const SizedBox(width: 3),
                            Text(
                              DateFormatter.mediumDate(
                                nextDue.dueDate,
                                languageCode: lang,
                              ),
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colors.inkMuted,
                                fontSize: 10.5,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                if (installments.overdueCount > 0) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444).withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.28),
                      ),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${installments.overdueCount}',
                          style: const TextStyle(
                            color: Color(0xFFEF4444),
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            height: 1.0,
                          ),
                        ),
                        const SizedBox(height: 1),
                        Text(
                          'متأخرة',
                          style: TextStyle(
                            color: const Color(0xFFEF4444).withValues(
                              alpha: 0.70,
                            ),
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          Divider(height: 1, color: colors.hairline),

          // Progress bar + stats
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (installments.totalCount > 0) ...[
                  Row(
                    children: [
                      Text(
                        '${installments.paidCount} / ${installments.totalCount}',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: colors.inkMuted,
                          fontSize: 10.5,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${(progress * 100).round()}%',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: colors.brandGold,
                          fontWeight: FontWeight.w700,
                          fontSize: 10.5,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 5,
                      backgroundColor: colors.surfaceSoft,
                      valueColor: AlwaysStoppedAnimation(colors.brandGold),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                IntrinsicHeight(
                  child: Row(
                    children: [
                      _FStat(
                        label: l10n.installmentStatusPaid,
                        value: '${installments.paidCount}',
                        valueColor: const Color(0xFF34C77B),
                      ),
                      _VLine(colors: colors),
                      _FStat(
                        label: 'متبقية',
                        value: '${installments.remainingCount}',
                      ),
                      if (installments.lastPaidAt != null) ...[
                        _VLine(colors: colors),
                        _FStat(
                          label: 'آخر دفعة',
                          value: DateFormatter.mediumDate(
                            installments.lastPaidAt!,
                            languageCode: lang,
                          ),
                          compact: true,
                        ),
                      ],
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

class _FinancialEmpty extends StatelessWidget {
  const _FinancialEmpty({
    required this.l10n,
    required this.theme,
    required this.colors,
  });
  final AppLocalizations l10n;
  final ThemeData theme;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: colors.success.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(
              Icons.check_circle_rounded,
              color: colors.success,
              size: 20,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.homeNoDuePayments,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  l10n.homeNoDuePaymentsHint,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: colors.inkMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FStat extends StatelessWidget {
  const _FStat({
    required this.label,
    required this.value,
    this.valueColor,
    this.compact = false,
  });
  final String label;
  final String value;
  final Color? valueColor;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Expanded(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            textAlign: TextAlign.center,
            style: theme.textTheme.labelSmall?.copyWith(
              color: colors.inkMuted,
              fontSize: 10,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            textAlign: TextAlign.center,
            maxLines: compact ? 2 : 1,
            style: theme.textTheme.bodySmall?.copyWith(
              color: valueColor ?? colors.inkStrong,
              fontWeight: FontWeight.w800,
              fontSize: compact ? 10.5 : 13,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _VLine extends StatelessWidget {
  const _VLine({required this.colors});
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) => Container(
        width: 1,
        margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
        color: colors.hairline,
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Maintenance card
// ─────────────────────────────────────────────────────────────────────────────

class _MaintenanceCard extends StatelessWidget {
  const _MaintenanceCard({required this.maintenance});
  final HomeSummaryMaintenance maintenance;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final colors = context.appColors;

    if (maintenance.recentRequests.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_navyLight, _navy],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(11),
              ),
              child: const Icon(
                AppIcons.maintenance,
                size: 17,
                color: AppPalette.gold300,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.maintenanceEmptyTitle,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    l10n.maintenanceEmptyMessage,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: colors.inkMuted),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < maintenance.recentRequests.length; i++) ...[
            if (i > 0) Divider(height: 1, color: colors.hairline),
            _MRow(
              item: maintenance.recentRequests[i],
              onTap: () => context.push('/account/maintenance'),
            ),
          ],
        ],
      ),
    );
  }
}

class _MRow extends StatelessWidget {
  const _MRow({required this.item, required this.onTap});
  final HomeSummaryMaintenanceItem item;
  final VoidCallback onTap;

  Color _toneColor(BadgeTone tone, AppColorsExt colors) => switch (tone) {
        BadgeTone.success => const Color(0xFF34C77B),
        BadgeTone.error => const Color(0xFFEF4444),
        BadgeTone.warning => const Color(0xFFF59E0B),
        BadgeTone.info => const Color(0xFF60A5FA),
        BadgeTone.gold => AppPalette.gold400,
        BadgeTone.navy => colors.brandNavy,
        _ => colors.inkMuted,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final theme = Theme.of(context);
    final colors = context.appColors;
    final title = item.categoryName?.resolve(lang).trim();
    final tone = maintenanceStatusTone(item.status);
    final sc = _toneColor(tone, colors);

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 11,
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [_navyLight, _navy],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                AppIcons.maintenance,
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
                    (title != null && title.isNotEmpty)
                        ? title
                        : (item.unitCode ?? '—'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    DateFormatter.mediumDate(
                      item.createdAt,
                      languageCode: lang,
                    ),
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: colors.inkMuted, fontSize: 11),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: sc.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: sc.withValues(alpha: 0.28)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 5,
                    height: 5,
                    decoration: BoxDecoration(
                      color: sc,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    maintenanceStatusLabel(l10n, item.status),
                    style: TextStyle(
                      color: sc,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    Widget bone({double? w, double h = 14, double r = 7}) => Container(
          width: w,
          height: h,
          decoration: BoxDecoration(
            color: colors.surfaceSoft,
            borderRadius: BorderRadius.circular(r),
          ),
        );

    return AppSkeletonizer(
      enabled: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Action card
            Container(
              height: 162,
              decoration: BoxDecoration(
                color: colors.surfaceSoft,
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            // Section header
            Row(
              children: [
                bone(w: 30, h: 30, r: 8),
                const SizedBox(width: AppSpacing.sm),
                bone(w: 90),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            // Property unit (card body + footer bar)
            Container(
              height: 280,
              decoration: BoxDecoration(
                color: colors.surfaceSoft,
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            // Financial section header
            Row(
              children: [
                bone(w: 30, h: 30, r: 8),
                const SizedBox(width: AppSpacing.sm),
                bone(w: 70),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Container(
              height: 120,
              decoration: BoxDecoration(
                color: colors.surfaceSoft,
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dot texture
// ─────────────────────────────────────────────────────────────────────────────

class _Dots extends StatelessWidget {
  const _Dots();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotsPainter(), child: SizedBox.expand());
}

class _DotsPainter extends CustomPainter {
  const _DotsPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, p);
      }
    }
  }

  @override
  bool shouldRepaint(_DotsPainter _) => false;
}
