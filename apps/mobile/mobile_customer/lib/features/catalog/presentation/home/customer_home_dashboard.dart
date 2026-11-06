import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../content/presentation/content_widgets.dart';
import '../../../../common/plan_banner.dart';
import '../../../home_summary/domain/entities/home_summary.dart';
import '../../../home_summary/presentation/home_summary_cubit.dart';
import '../../../maintenance/presentation/maintenance_format.dart';
import '../../../notifications/presentation/unread_count_cubit.dart';
import 'customer_home_header.dart';

Color get _navy => AppPalette.navyDeep;
Color get _navyCard => AppPalette.navyCard;
Color get _navyLight => AppPalette.navyLight;

// Money for tight spaces, without losing piasters below a million.
String _compact(String raw, String lang) {
  final n = double.tryParse(raw) ?? 0;
  final sym = PriceFormatter.symbol(lang);
  // Millions to two decimals ("1.45 مليون"), below a million the exact
  // amount: rounded to the whole million / thousand, 1,450,000 read
  // "1 مليون" and 24,500 "25 ألف".
  if (n.abs() >= 1000000) {
    final m = (n / 1000000).toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '');
    return lang == 'ar' ? '$m مليون $sym' : '${m}M $sym';
  }
  return PriceFormatter.formatString(raw, languageCode: lang);
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

class CustomerHomeDashboard extends StatelessWidget {
  const CustomerHomeDashboard({super.key, required this.name, this.showHeader = true});
  final String? name;
  final bool showHeader;

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
            if (showHeader) ...[
              CustomerHomeHeader(
                name: displayName,
                hasProperty: summary?.profile.isOwner ?? false,
              ),
              const SizedBox(height: AppSpacing.md),
            ],
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
          // CMS1 — the company's banners, as on its website.
          const HomeBanners(padding: EdgeInsets.only(bottom: AppSpacing.md)),
          // 1 · Action card
          _ActionCard(action: summary.primaryAction),
          const SizedBox(height: AppSpacing.md),

          // 2 · Property unit: card + quick actions footer as one visual block
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
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_navyLight, _navy],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Icon(icon, size: 18, color: AppPalette.gold300),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Row(
            children: [
              Text(
                title,
                style: theme.textTheme.titleMedium?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (countBadge != null) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 3,
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
                      fontSize: 12,
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
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
          child: Align(
            alignment: AlignmentDirectional.centerEnd,
            child: Text(
              label,
              style: TextStyle(
                color: context.appColors.brandGold,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
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
        gradient: LinearGradient(
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
                      fontSize: 12,
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
                                size: 13,
                                color: Colors.white.withValues(alpha: 0.55),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                DateFormatter.mediumDate(
                                  action.dueDate!,
                                  languageCode: lang,
                                ),
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.60),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  height: 1.2,
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
              fontSize: 12,
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
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          child: Ink(
            height: 40,
            decoration: BoxDecoration(
              gradient: LinearGradient(
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
            child: Align(
              alignment: Alignment.center,
              child: Text(
                label,
                style: TextStyle(
                  color: _navy,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
              ),
            ),
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
        _Stat(l10n.myPropertyContractNumber, property.contractNumber!, ltr: true),
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
              unitType: unitTypeLabel(property.unitType, languageCode: lang),
              unitCode: property.unitCode,
              city: property.city,
              owned: owned,
              l10n: l10n,
            ),
          ),
          Divider(height: 1, indent: AppSpacing.lg, endIndent: AppSpacing.lg, color: colors.hairline),
          if (stats.isNotEmpty) _StatsBlock(stats: stats, colors: colors),
          if (property.hasInstallmentPlan &&
              property.monthlyAmount != null &&
              property.totalMonths != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.sm),
              child: PlanBanner(
                labelText:     l10n.myPropertyInstallmentPlan,
                amountText:    _compact(property.monthlyAmount!, lang),
                secondaryText: lang == 'ar'
                    ? 'شهريًا · ${property.totalMonths} شهرًا'
                    : 'mo · ${property.totalMonths} months',
              ),
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
    final colors = context.appColors;
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final dotColor = owned
        ? (dark ? const Color(0xFF4ADE80) : const Color(0xFF15803D))
        : (dark ? AppPalette.gold300 : const Color(0xFF9A6F1E));
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.md,
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: AppPalette.gold400.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              Icons.domain_rounded,
              color: dark ? AppPalette.gold300 : const Color(0xFF9A6F1E),
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
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  city.isNotEmpty
                      ? '$unitType · $unitCode · $city'
                      : '$unitType · $unitCode',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colors.inkMuted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(
              color: dotColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration:
                      BoxDecoration(color: dotColor, shape: BoxShape.circle),
                ),
                const SizedBox(width: 5),
                Text(
                  owned
                      ? l10n.myPropertyStatusOwned
                      : l10n.myPropertyStatusReserved,
                  style: TextStyle(
                    color: dotColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
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
  const _Stat(this.label, this.value, {this.ltr = false});
  final String label;
  final String value;
  final bool ltr;
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
                  Directionality(
                    textDirection: stats[i].ltr
                        ? TextDirection.ltr
                        : Directionality.of(context),
                    child: Text(
                      stats[i].value,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w800,
                      ),
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
        label: l10n.accountContracts,
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
      height: 84,
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
                height: 84,
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
      child: Semantics(
        button: true,
        label: label,
        child: Material(
          color: colors.surface,
          child: InkWell(
            onTap: onTap,
            splashColor: AppPalette.gold400.withValues(alpha: 0.08),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: 18,
                  color: AppPalette.gold500.withValues(alpha: 0.80),
                ),
                const SizedBox(height: 3),
                Text(
                  label,
                  maxLines: 2,
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: colors.inkMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    height: 1.2,
                  ),
                ),
              ],
            ),
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
              gradient: LinearGradient(
                colors: [_navyLight, _navy],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(
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
                gradient: LinearGradient(
                  colors: [AppPalette.gold300, AppPalette.gold500],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
              child: Text(
                l10n.homeExploreProjects,
                style: TextStyle(
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

  static Color get _navyDark => AppPalette.navyDarkest;
  static Color get _navyMid => AppPalette.navyMid2;
  static Color get _navyFoot => AppPalette.navyFoot;

  @override
  Widget build(BuildContext context) {
    final l10n    = context.l10n;
    final lang    = Localizations.localeOf(context).languageCode;
    final nextDue = installments.nextDue;
    final hasData = installments.totalCount > 0 || nextDue != null;

    if (!hasData) return _FinancialEmpty(l10n: l10n);

    final total     = installments.totalCount;
    final paid      = installments.paidCount;
    final overdue   = installments.overdueCount;
    final remaining = installments.remainingCount;
    final pending   = (remaining - overdue).clamp(0, remaining);
    final progress  = total > 0 ? (paid / total).clamp(0.0, 1.0) : 0.0;
    final isOverdue = overdue > 0;

    final mainColor = isOverdue
        ? const Color(0xFFEF4444)
        : const Color(0xFF34C77B);

    final amountLabel = isOverdue
        ? l10n.overdueInstallments(overdue)
        : l10n.homeNextInstallment;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [_navyDark, _navyMid],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isOverdue
              ? const Color(0xFFEF4444).withValues(alpha: 0.20)
              : Colors.white.withValues(alpha: 0.06),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.30),
            blurRadius: 30,
            offset: const Offset(0, 10),
            spreadRadius: -4,
          ),
          if (isOverdue)
            BoxShadow(
              color: const Color(0xFFEF4444).withValues(alpha: 0.16),
              blurRadius: 40,
              offset: const Offset(0, 6),
            ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [

          // ── Header ────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
            child: Row(
              children: [
                // Icon + title
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: AppPalette.gold400.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppPalette.gold400.withValues(alpha: 0.22),
                    ),
                  ),
                  child: Icon(
                    Icons.account_balance_wallet_rounded,
                    color: AppPalette.gold400,
                    size: 17,
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  context.l10n.financialPanel,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.2,
                  ),
                ),
                const Spacer(),
                // Status badge
                if (isOverdue)
                  _HeaderBadge(
                    icon: Icons.warning_amber_rounded,
                    label: context.l10n.overdueCountBadge(overdue),
                    color: const Color(0xFFEF4444),
                  )
                else
                  _HeaderBadge(
                    label: context.l10n.onTrackBadge,
                    color: const Color(0xFF34C77B),
                    dot: true,
                  ),
              ],
            ),
          ),

          // separator
          Container(height: 0.5, color: Colors.white.withValues(alpha: 0.07)),

          // ── Main amount ───────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        amountLabel,
                        style: TextStyle(
                          color: isOverdue
                              ? const Color(0xFFEF4444).withValues(alpha: 0.72)
                              : Colors.white.withValues(alpha: 0.48),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 7),
                      if (nextDue != null)
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: AlignmentDirectional.centerStart,
                          child: Text(
                            PriceFormatter.formatString(
                              nextDue.amount,
                              languageCode: lang,
                            ),
                            style: TextStyle(
                              color: isOverdue
                                  ? const Color(0xFFEF4444)
                                  : Colors.white,
                              fontSize: 38,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.8,
                              height: 1.0,
                            ),
                          ),
                        )
                      else
                        Text(
                          l10n.homeNoDuePayments,
                          style: const TextStyle(
                            color: Color(0xFF34C77B),
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      if (nextDue != null) ...[
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: isOverdue
                                ? const Color(0xFFEF4444).withValues(alpha: 0.09)
                                : Colors.white.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(9),
                            border: Border.all(
                              color: isOverdue
                                  ? const Color(0xFFEF4444).withValues(alpha: 0.22)
                                  : Colors.white.withValues(alpha: 0.10),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.calendar_month_rounded,
                                size: 13,
                                color: isOverdue
                                    ? const Color(0xFFEF4444).withValues(alpha: 0.65)
                                    : Colors.white.withValues(alpha: 0.45),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                DateFormatter.mediumDate(
                                  nextDue.dueDate,
                                  languageCode: lang,
                                ),
                                style: TextStyle(
                                  color: isOverdue
                                      ? const Color(0xFFEF4444)
                                      : Colors.white.withValues(alpha: 0.80),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                // Status icon circle
                Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    color: mainColor.withValues(alpha: 0.10),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: mainColor.withValues(alpha: 0.24),
                      width: 1.5,
                    ),
                  ),
                  child: Icon(
                    isOverdue
                        ? Icons.warning_amber_rounded
                        : (nextDue != null
                            ? Icons.schedule_rounded
                            : Icons.check_circle_rounded),
                    color: mainColor,
                    size: 25,
                  ),
                ),
              ],
            ),
          ),

          // ── Progress ──────────────────────────────────────────────────
          if (total > 0) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        context.l10n.paymentProgress,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.38),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.4,
                        ),
                      ),
                      Text(
                        '$paid / $total  ·  ${(progress * 100).round()}%',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.38),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 7),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progress,
                      backgroundColor: Colors.white.withValues(alpha: 0.08),
                      valueColor: AlwaysStoppedAnimation<Color>(
                        isOverdue
                            ? const Color(0xFFEF4444)
                            : const Color(0xFF34C77B),
                      ),
                      minHeight: 5,
                    ),
                  ),
                ],
              ),
            ),
          ],

          // ── Stats footer ──────────────────────────────────────────────
          Container(height: 0.5, color: Colors.white.withValues(alpha: 0.07)),
          Container(
            color: _navyFoot,
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: IntrinsicHeight(
              child: Row(
                children: [
                  _NStat(
                    label: context.l10n.installmentStatusPaid,
                    value: '$paid',
                    color: const Color(0xFF34C77B),
                  ),
                  _NVLine(),
                  _NStat(
                    label: context.l10n.installmentStatusOverdue,
                    value: '$overdue',
                    color: overdue > 0
                        ? const Color(0xFFEF4444)
                        : Colors.white.withValues(alpha: 0.28),
                  ),
                  _NVLine(),
                  _NStat(
                    label: context.l10n.installmentStatusPending,
                    value: '$pending',
                    color: AppPalette.gold400,
                  ),
                  _NVLine(),
                  _NStat(
                    label: context.l10n.remainingLabel,
                    value: '$remaining',
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderBadge extends StatelessWidget {
  const _HeaderBadge({
    required this.label,
    required this.color,
    this.icon,
    this.dot = false,
  });
  final String label;
  final Color  color;
  final IconData? icon;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: color),
            const SizedBox(width: 4),
          ] else if (dot) ...[
            Container(
              width: 5, height: 5,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: color, fontSize: 12, fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _FinancialEmpty extends StatelessWidget {
  const _FinancialEmpty({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppPalette.navyDarkest, AppPalette.navyMid2],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFF34C77B).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFF34C77B).withValues(alpha: 0.25),
              ),
            ),
            child: const Icon(
              Icons.check_circle_rounded,
              color: Color(0xFF34C77B),
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.homeNoDuePayments,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  l10n.homeNoDuePaymentsHint,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.45),
                    fontSize: 13,
                    fontWeight: FontWeight.w400,
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

class _NStat extends StatelessWidget {
  const _NStat({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final String value;
  final Color  color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            value,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: color,
              fontSize: 22,
              fontWeight: FontWeight.w900,
              height: 1.0,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.38),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _NVLine extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        width: 0.5,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        color: Colors.white.withValues(alpha: 0.08),
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
                gradient: LinearGradient(
                  colors: [_navyLight, _navy],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(
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
          vertical: 14,
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [_navyLight, _navy],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(
                AppIcons.maintenance,
                size: 18,
                color: AppPalette.gold300,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
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
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    DateFormatter.mediumDate(
                      item.createdAt,
                      languageCode: lang,
                    ),
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: colors.inkMuted, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
              decoration: BoxDecoration(
                color: sc.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: sc.withValues(alpha: 0.28)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: sc,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    maintenanceStatusLabel(l10n, item.status),
                    style: TextStyle(
                      color: sc,
                      fontSize: 13,
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
