import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../favorites/presentation/favorites_cubit.dart';
import '../../../installments/domain/entities/installment.dart';
import '../../../installments/presentation/cubit/installments_cubit.dart';
import '../../../maintenance/domain/entities/maintenance_request.dart';
import '../../../maintenance/presentation/maintenance_format.dart';
import '../../../maintenance/presentation/maintenance_requests_cubit.dart';
import '../../../my_property/domain/entities/property.dart';
import '../../../my_property/presentation/my_property_cubit.dart';
import '../../../notifications/presentation/unread_count_cubit.dart';
import 'customer_home_header.dart';

/// Customer Home V2 — *Ownership Command Center*.
///
/// Reads only cubits already provided to the `/home` route (no new API calls of
/// its own, no business-logic changes). Vertical order answers the owner's
/// questions: who am I (header) → what do I owe (payment hero) → what do I own
/// (property) → live counts (metric strip) → fast services → recent updates.
/// Discovery (featured projects/units) is NOT part of the customer Home.
class CustomerHomeDashboard extends StatelessWidget {
  const CustomerHomeDashboard({super.key, required this.name});

  final String? name;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<MyPropertyCubit, MyPropertyState>(
      builder: (context, propertyState) {
        return BlocBuilder<InstallmentsCubit, InstallmentsState>(
          builder: (context, installmentState) {
            final properties = propertyState.data ?? const <Property>[];
            final primary = properties.isNotEmpty ? properties.first : null;

            final installments = installmentState.data ?? const <Installment>[];
            final unpaid = installments
                .where((i) => i.status != InstallmentStatus.paid)
                .toList();
            final overdueCount = installments
                .where((i) => i.status == InstallmentStatus.overdue)
                .length;
            final next = _earliestDue(unpaid);
            final loading = installmentState.status == DataStatus.loading;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 1 · Premium in-body header (full-bleed, owns its top inset).
                CustomerHomeHeader(name: name, hasProperty: primary != null),
                const SizedBox(height: AppSpacing.lg),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                  ),
                  child: StaggeredColumn(
                    spacing: AppSpacing.lg,
                    children: [
                      // 2 · Critical payment / status hero.
                      _PaymentHero(
                        next: next,
                        unpaidCount: unpaid.length,
                        loading: loading,
                      ),
                      // 3 · My Property (the ownership centerpiece).
                      if (primary != null)
                        _MyPropertyCard(
                          property: primary,
                          extraCount: properties.length - 1,
                        ),
                      // 4 · Compact live metric strip.
                      _MetricStrip(
                        unpaidCount: unpaid.length,
                        overdueCount: overdueCount,
                        installmentsLoading: loading,
                      ),
                      // 5 · Fast service launcher.
                      const _ServiceLauncher(),
                      // 6 · Recent activity (hides when empty).
                      const _RecentActivity(),
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

  /// Earliest-dated unpaid installment (an overdue one naturally sorts first).
  static Installment? _earliestDue(List<Installment> unpaid) {
    if (unpaid.isEmpty) return null;
    return unpaid.reduce((a, b) => a.dueDate.isBefore(b.dueDate) ? a : b);
  }
}

// ── 2 · Critical payment / status hero ──────────────────────────────────────

class _PaymentHero extends StatelessWidget {
  const _PaymentHero({
    required this.next,
    required this.unpaidCount,
    required this.loading,
  });

  final Installment? next;
  final int unpaidCount;
  final bool loading;

  /// "Due soon" window for the مستحق قريبًا badge.
  static const _dueSoonDays = 14;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    final hasDue = next != null;
    final overdue = next?.status == InstallmentStatus.overdue;

    // Status badge label + tone for the upcoming payment.
    String? badgeLabel;
    BadgeTone badgeTone = BadgeTone.gold;
    AppTone railTone = AppTone.success;
    if (hasDue) {
      if (overdue) {
        badgeLabel = l10n.installmentStatusOverdue;
        badgeTone = BadgeTone.error;
        railTone = AppTone.error;
      } else {
        final days = next!.dueDate.difference(DateTime.now()).inDays;
        if (days <= _dueSoonDays) {
          badgeLabel = l10n.homePaymentDueSoon;
          badgeTone = BadgeTone.warning;
          railTone = AppTone.warning;
        } else {
          badgeLabel = l10n.homePaymentUpcoming;
          badgeTone = BadgeTone.gold;
          railTone = AppTone.gold;
        }
      }
    }

    final Widget body = hasDue
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    l10n.homeNextInstallment,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: colors.inkMuted,
                    ),
                  ),
                  const Spacer(),
                  StatusBadge(label: badgeLabel!, tone: badgeTone, dot: true),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                PriceFormatter.formatString(next!.amount, languageCode: lang),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.headlineSmall?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                l10n.installmentDueOn(
                  DateFormatter.mediumDate(next!.dueDate, languageCode: lang),
                ),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: colors.inkMuted,
                ),
              ),
              if (unpaidCount > 1) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  l10n.homeInstallmentsRemaining(unpaidCount),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colors.inkMuted,
                  ),
                ),
              ],
            ],
          )
        : Row(
            children: [
              IconChip(
                icon: Icons.check_circle_rounded,
                tone: AppTone.success,
                size: IconChipSize.md,
                filled: true,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.homeNoDuePayments,
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      l10n.homeNoDuePaymentsHint,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.inkMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );

    return PremiumCard(
      glow: true,
      accentRail: railTone,
      child: AppSkeletonizer(
        enabled: loading,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            body,
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: l10n.homeViewInstallments,
                    icon: AppIcons.installments,
                    variant: AppButtonVariant.primary,
                    size: AppButtonSize.medium,
                    onPressed: () => context.push('/account/installments'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: AppButton(
                    label: l10n.myPropertyRequestMaintenance,
                    icon: AppIcons.maintenance,
                    variant: AppButtonVariant.outline,
                    size: AppButtonSize.medium,
                    onPressed: () => context.push('/account/maintenance/new'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── 3 · My property card ────────────────────────────────────────────────────

class _MyPropertyCard extends StatelessWidget {
  const _MyPropertyCard({required this.property, required this.extraCount});

  final Property property;
  final int extraCount;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final owned = property.status == PropertyStatus.owned;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppSectionHeader(
          title: l10n.homeAfterSales,
          action: extraCount > 0
              ? TextButton(
                  onPressed: () => context.push('/account/property'),
                  child: Text(l10n.viewAll),
                )
              : null,
        ),
        const SizedBox(height: AppSpacing.sm),
        PremiumCard(
          onTap: () => context.push('/account/property'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  IconChip(
                    icon: AppIcons.property,
                    tone: AppTone.gold,
                    filled: true,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          property.projectName.resolve(lang),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: colors.inkStrong,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${property.unitType} · ${property.unitCode}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colors.inkMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  StatusBadge(
                    label: owned
                        ? l10n.myPropertyStatusOwned
                        : l10n.myPropertyStatusReserved,
                    tone: owned ? BadgeTone.success : BadgeTone.warning,
                    dot: true,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Divider(height: 1, color: colors.hairline),
              const SizedBox(height: AppSpacing.md),
              if (property.contractNumber != null)
                _MetaRow(
                  label: l10n.myPropertyContractNumber,
                  value: property.contractNumber!,
                ),
              if (property.signedAt != null)
                _MetaRow(
                  label: l10n.myPropertySignedDate,
                  value: DateFormatter.mediumDate(
                    property.signedAt!,
                    languageCode: lang,
                  ),
                ),
              if (property.hasInstallmentPlan)
                _MetaRow(
                  label: l10n.myPropertyInstallmentPlan,
                  value: l10n.myPropertyInstallmentSummary(
                    PriceFormatter.formatString(
                      property.monthlyAmount,
                      languageCode: lang,
                    ),
                    property.totalMonths!,
                  ),
                ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  _PropertyLink(
                    icon: AppIcons.property,
                    label: l10n.accountMyProperty,
                    onTap: () => context.push('/account/property'),
                  ),
                  _PropertyLink(
                    icon: AppIcons.contract,
                    label: l10n.accountContracts,
                    onTap: () => context.push('/account/contracts'),
                  ),
                  _PropertyLink(
                    icon: AppIcons.deposit,
                    label: l10n.accountDeposits,
                    onTap: () => context.push('/account/deposits'),
                  ),
                  _PropertyLink(
                    icon: AppIcons.maintenance,
                    label: l10n.myPropertyRequestMaintenance,
                    onTap: () => context.push(
                      '/account/maintenance/new',
                      extra: {'unitId': property.unitId},
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: colors.inkMuted,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: theme.textTheme.bodySmall?.copyWith(
                color: colors.inkStrong,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PropertyLink extends StatelessWidget {
  const _PropertyLink({
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
      borderRadius: AppRadii.pillAll,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: colors.brandGold),
              const SizedBox(width: AppSpacing.xs),
              Text(
                label,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── 4 · Compact live metric strip ───────────────────────────────────────────

class _MetricStrip extends StatelessWidget {
  const _MetricStrip({
    required this.unpaidCount,
    required this.overdueCount,
    required this.installmentsLoading,
  });

  final int unpaidCount;
  final int overdueCount;
  final bool installmentsLoading;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppSectionHeader(title: l10n.dashboardOverview),
        const SizedBox(height: AppSpacing.sm),
        PremiumCard(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: _MetricCell(
                    icon: AppIcons.installments,
                    value: '$unpaidCount',
                    label: l10n.installmentsTitle,
                    tone: overdueCount > 0 ? AppTone.error : AppTone.gold,
                    loading: installmentsLoading,
                    onTap: () => context.push('/account/installments'),
                  ),
                ),
                _StripDivider(color: colors.hairline),
                Expanded(
                  child:
                      BlocBuilder<
                        MaintenanceRequestsCubit,
                        MaintenanceRequestsState
                      >(
                        builder: (context, state) {
                          final open =
                              (state.data ?? const <MaintenanceRequest>[])
                                  .where((r) => _isOpen(r.status))
                                  .length;
                          return _MetricCell(
                            icon: AppIcons.maintenance,
                            value: '$open',
                            label: l10n.accountMaintenance,
                            tone: AppTone.navy,
                            loading: state.status == DataStatus.loading,
                            onTap: () => context.push('/account/maintenance'),
                          );
                        },
                      ),
                ),
                _StripDivider(color: colors.hairline),
                Expanded(
                  child: BlocBuilder<UnreadCountCubit, int>(
                    builder: (context, count) => _MetricCell(
                      icon: AppIcons.notification,
                      value: '$count',
                      label: l10n.accountNotifications,
                      tone: AppTone.gold,
                      onTap: () => context.push('/account/notifications'),
                    ),
                  ),
                ),
                _StripDivider(color: colors.hairline),
                Expanded(
                  child: BlocBuilder<FavoritesCubit, FavoritesState>(
                    builder: (context, state) => _MetricCell(
                      icon: AppIcons.favorite,
                      value: '${state.items.length}',
                      label: l10n.accountFavorites,
                      tone: AppTone.muted,
                      loading: state.status == DataStatus.loading,
                      onTap: () => context.push('/account/favorites'),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static bool _isOpen(MaintenanceStatus s) =>
      s == MaintenanceStatus.open ||
      s == MaintenanceStatus.assigned ||
      s == MaintenanceStatus.inProgress;
}

class _StripDivider extends StatelessWidget {
  const _StripDivider({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) => VerticalDivider(
    width: 1,
    thickness: 1,
    color: color,
    indent: 6,
    endIndent: 6,
  );
}

class _MetricCell extends StatelessWidget {
  const _MetricCell({
    required this.icon,
    required this.value,
    required this.label,
    required this.tone,
    required this.onTap,
    this.loading = false,
  });

  final IconData icon;
  final String value;
  final String label;
  final AppTone tone;
  final VoidCallback onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return InkWell(
      onTap: loading ? null : onTap,
      borderRadius: AppRadii.input,
      child: AppSkeletonizer(
        enabled: loading,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconChip(icon: icon, tone: tone, size: IconChipSize.sm),
              const SizedBox(height: AppSpacing.xs),
              Text(
                loading ? '0' : value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleMedium?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: colors.inkMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── 5 · Fast service launcher ───────────────────────────────────────────────

class _ServiceItem {
  const _ServiceItem(
    this.icon,
    this.tone,
    this.title,
    this.subtitle,
    this.route,
  );
  final IconData icon;
  final AppTone tone;
  final String title;
  final String subtitle;
  final String route;
}

class _ServiceLauncher extends StatelessWidget {
  const _ServiceLauncher();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final rtl = Directionality.of(context) == TextDirection.rtl;

    final items = <_ServiceItem>[
      _ServiceItem(
        AppIcons.property,
        AppTone.gold,
        l10n.accountMyProperty,
        l10n.homeServiceUnitSub,
        '/account/property',
      ),
      _ServiceItem(
        AppIcons.contract,
        AppTone.navy,
        l10n.accountContracts,
        l10n.homeServiceContractsSub,
        '/account/contracts',
      ),
      _ServiceItem(
        AppIcons.deposit,
        AppTone.gold,
        l10n.accountDeposits,
        l10n.homeServicePaymentsSub,
        '/account/deposits',
      ),
      _ServiceItem(
        AppIcons.visit,
        AppTone.navy,
        l10n.navVisits,
        l10n.homeServiceVisitsSub,
        '/account/requests',
      ),
    ];

    final theme = Theme.of(context);
    final colors = context.appColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppSectionHeader(title: l10n.dashboardQuickActions),
        const SizedBox(height: AppSpacing.sm),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: AppSpacing.sm,
          crossAxisSpacing: AppSpacing.sm,
          childAspectRatio: 2.5,
          children: [
            for (final s in items)
              PremiumCard(
                elevation: AppCardElevation.soft,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                onTap: () => context.push(s.route),
                child: Row(
                  children: [
                    IconChip(icon: s.icon, tone: s.tone, size: IconChipSize.sm),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            s.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall?.copyWith(
                              color: colors.inkStrong,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            s.subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: colors.inkMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      rtl
                          ? Icons.chevron_left_rounded
                          : Icons.chevron_right_rounded,
                      size: 18,
                      color: colors.inkMuted,
                    ),
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }
}

// ── 6 · Recent activity ─────────────────────────────────────────────────────

/// Latest maintenance updates (max 3). Hides entirely when there's nothing to
/// show. Uses the maintenance cubit already loaded for the metric strip — no
/// extra fetch.
class _RecentActivity extends StatelessWidget {
  const _RecentActivity();

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
            AppSectionHeader(
              title: l10n.homeRecentActivity,
              action: TextButton(
                onPressed: () => context.push('/account/maintenance'),
                child: Text(l10n.viewAll),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            PremiumCard(
              child: Column(
                children: [
                  for (var i = 0; i < recent.length; i++) ...[
                    if (i > 0)
                      Divider(height: AppSpacing.lg, color: colors.hairline),
                    _ActivityRow(request: recent[i]),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.request});

  final MaintenanceRequest request;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final title = request.categoryName?.resolve(lang).trim();

    return InkWell(
      borderRadius: AppRadii.input,
      onTap: () =>
          context.push('/account/maintenance/${request.id}', extra: request),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconChip(
            icon: AppIcons.maintenance,
            tone: AppTone.navy,
            size: IconChipSize.sm,
          ),
          const SizedBox(width: AppSpacing.sm),
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
                  const SizedBox(height: 2),
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
    );
  }
}
