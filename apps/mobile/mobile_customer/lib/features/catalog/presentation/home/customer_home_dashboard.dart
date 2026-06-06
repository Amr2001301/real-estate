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

/// Customer Home — an editorial, ownership-first dashboard.
///
/// Deliberately focused: identity → the next payment that needs attention → the
/// owned asset and its after-sales services → recent service activity. Tab-level
/// navigation lives in the bottom bar, so the home does NOT repeat it as a
/// generic metric strip or quick-action grid. Reads only cubits already provided
/// to the `/home` route (no new API calls, no business-logic changes).
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

            final installments = installmentState.data ?? const <Installment>[];
            final unpaid = installments
                .where((i) => i.status != InstallmentStatus.paid)
                .toList();
            final next = _earliestDue(unpaid);
            final loading = installmentState.status == DataStatus.loading;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                CustomerHomeHeader(name: name, hasProperty: primary != null),
                const SizedBox(height: AppSpacing.lg),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // 1 · The single most urgent obligation.
                      _PaymentHero(
                        next: next,
                        unpaidCount: unpaid.length,
                        loading: loading,
                      ),
                      const SizedBox(height: AppSpacing.xl),

                      // 2 · The owned asset + its after-sales services.
                      if (primary != null) ...[
                        _SectionHeading(
                          title: l10n.homeAfterSales,
                          onViewAll: properties.length > 1
                              ? () => context.push('/account/property')
                              : null,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _MyPropertyCard(property: primary),
                        const SizedBox(height: AppSpacing.xl),
                      ] else ...[
                        const _OwnerEmptyCard(),
                        const SizedBox(height: AppSpacing.xl),
                      ],

                      // 3 · Recent service activity (hides when empty).
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

/// A refined section heading: a small gold tick + title, with an optional
/// trailing "view all". Lighter and more editorial than a heavy card header.
class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.title, this.onViewAll});

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
          height: 16,
          decoration: BoxDecoration(
            color: colors.brandGold,
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

// ── 1 · Critical payment / status hero ──────────────────────────────────────

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
                      letterSpacing: 0.2,
                    ),
                  ),
                  const Spacer(),
                  StatusBadge(label: badgeLabel!, tone: badgeTone, dot: true),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                PriceFormatter.formatString(next!.amount, languageCode: lang),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.headlineMedium?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w800,
                  height: 1.05,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                _subline(l10n, lang),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: colors.inkMuted,
                ),
              ),
            ],
          )
        : Row(
            children: [
              IconChip(
                icon: Icons.verified_rounded,
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
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
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

    // Keep the warm gold glow only for positive states; an overdue (red) or
    // due-soon (amber) card shouldn't carry a celebratory glow behind its rail.
    final positiveGlow =
        railTone == AppTone.success || railTone == AppTone.gold;

    return PremiumCard(
      glow: positiveGlow,
      accentRail: railTone,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: AppSkeletonizer(
        enabled: loading,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            body,
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: AppButton(
                label: l10n.homeViewInstallments,
                icon: AppIcons.installments,
                variant: AppButtonVariant.primary,
                size: AppButtonSize.medium,
                onPressed: () => context.push('/account/installments'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// "Due on {date} · {n} remaining" — one calm line instead of two.
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

// ── 2 · My property card ────────────────────────────────────────────────────

class _MyPropertyCard extends StatelessWidget {
  const _MyPropertyCard({required this.property});

  final Property property;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
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

    return PremiumCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      onTap: () => context.push('/account/property'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Identity row.
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconChip(
                icon: AppIcons.property,
                tone: AppTone.gold,
                size: IconChipSize.lg,
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
                    const SizedBox(height: 3),
                    Text(
                      '${property.unitType} · ${property.unitCode}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.inkMuted,
                        letterSpacing: 0.2,
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

          // Contract facts — a clean inline stat grid (web parity).
          if (stats.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            Container(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(color: colors.hairline),
                  bottom: BorderSide(color: colors.hairline),
                ),
              ),
              child: IntrinsicHeight(
                child: Row(
                  children: [
                    for (var i = 0; i < stats.length; i++) ...[
                      if (i > 0)
                        VerticalDivider(
                          width: 1,
                          thickness: 1,
                          color: colors.hairline,
                          indent: 2,
                          endIndent: 2,
                        ),
                      Expanded(child: _StatColumn(stat: stats[i])),
                    ],
                  ],
                ),
              ),
            ),
          ],

          // After-sales services — the contextual quick actions for this unit.
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: _ServicePill(
                  icon: AppIcons.installments,
                  label: l10n.installmentsTitle,
                  onTap: () => context.push('/account/installments'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _ServicePill(
                  icon: AppIcons.contract,
                  label: l10n.accountContracts,
                  onTap: () => context.push('/account/contracts'),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: _ServicePill(
                  icon: AppIcons.deposit,
                  label: l10n.accountDeposits,
                  onTap: () => context.push('/account/deposits'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _ServicePill(
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
    );
  }
}

class _Stat {
  const _Stat(this.label, this.value);
  final String label;
  final String value;
}

class _StatColumn extends StatelessWidget {
  const _StatColumn({required this.stat});
  final _Stat stat;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          stat.label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.labelSmall?.copyWith(
            color: colors.inkMuted,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          stat.value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: colors.inkStrong,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

/// A compact, premium after-sales action: soft surface, gold glyph, centered
/// label. Equal-width so a row of them reads as a matched set.
class _ServicePill extends StatelessWidget {
  const _ServicePill({
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
      borderRadius: AppRadii.input,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.sm + 1,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: colors.brandGold),
              const SizedBox(width: AppSpacing.xs),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w700,
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

/// Shown to a signed-in customer who owns nothing yet — a single warm prompt
/// into discovery (the only place the customer home points outward).
class _OwnerEmptyCard extends StatelessWidget {
  const _OwnerEmptyCard();

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

// ── 3 · Recent activity ─────────────────────────────────────────────────────

/// Latest maintenance updates (max 3). Hides entirely when there's nothing to
/// show. Uses the maintenance cubit already loaded by the /home route.
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
            _SectionHeading(
              title: l10n.homeRecentActivity,
              onViewAll: () => context.push('/account/maintenance'),
            ),
            const SizedBox(height: AppSpacing.sm),
            PremiumCard(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.xs,
              ),
              child: Column(
                children: [
                  for (var i = 0; i < recent.length; i++) ...[
                    if (i > 0) Divider(height: 1, color: colors.hairline),
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
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        child: Row(
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
      ),
    );
  }
}
