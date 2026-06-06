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

/// Ownership-first customer home dashboard.
///
/// Reads only cubits already provided to the `/home` route (no new API calls of
/// its own, no business-logic changes). The hierarchy answers the owner's
/// questions in order: what do I own, what payment needs attention, what live
/// counts matter, quick actions, and recent service updates — discovery
/// (featured projects/units) stays BELOW this, owned by [HomeScreen].
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

            return StaggeredColumn(
              spacing: AppSpacing.lg,
              children: [
                _OwnershipHero(
                  name: name,
                  hasProperty: primary != null,
                  next: next,
                  unpaidCount: unpaid.length,
                  loading: installmentState.status == DataStatus.loading,
                ),
                if (primary != null)
                  _MyPropertyCard(
                    property: primary,
                    extraCount: properties.length - 1,
                  ),
                _PrioritySummary(
                  unpaidCount: unpaid.length,
                  overdueCount: overdueCount,
                  installmentsLoading:
                      installmentState.status == DataStatus.loading,
                ),
                const _QuickActions(),
                const _RecentActivity(),
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

// ── 1 · Ownership hero ──────────────────────────────────────────────────────

/// Compact, premium identity + next-payment highlight. Always fits in the first
/// viewport: greeting, owner status, the single most urgent installment, and
/// the two primary owner actions.
class _OwnershipHero extends StatelessWidget {
  const _OwnershipHero({
    required this.name,
    required this.hasProperty,
    required this.next,
    required this.unpaidCount,
    required this.loading,
  });

  final String? name;
  final bool hasProperty;
  final Installment? next;
  final int unpaidCount;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);

    return PremiumCard(
      glow: true,
      accentRail: AppTone.gold,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              GradientAvatar(name: name, size: 46),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.dashboardWelcome,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: colors.brandGold,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      name == null
                          ? l10n.accountRoleCustomer
                          : l10n.homeGreeting(name!),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              StatusBadge(
                label: hasProperty
                    ? l10n.homeOwnerRole
                    : l10n.accountRoleCustomer,
                tone: hasProperty ? BadgeTone.gold : BadgeTone.navy,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _NextPaymentBox(
            next: next,
            unpaidCount: unpaidCount,
            loading: loading,
          ),
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
    );
  }
}

/// The next-due payment highlight inside the hero. Shows the amount + a due /
/// overdue badge, or an "all caught up" state when nothing is owed.
class _NextPaymentBox extends StatelessWidget {
  const _NextPaymentBox({
    required this.next,
    required this.unpaidCount,
    required this.loading,
  });

  final Installment? next;
  final int unpaidCount;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final lang = Localizations.localeOf(context).languageCode;

    final hasDue = next != null;
    final overdue = next?.status == InstallmentStatus.overdue;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: AppRadii.input,
        border: Border.all(color: colors.hairline),
      ),
      child: AppSkeletonizer(
        enabled: loading,
        child: hasDue
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.homeNextInstallment,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: colors.inkMuted,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          PriceFormatter.formatString(
                            next!.amount,
                            languageCode: lang,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: colors.inkStrong,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if (unpaidCount > 1) ...[
                          const SizedBox(height: 2),
                          Text(
                            l10n.homeInstallmentsRemaining(unpaidCount),
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
                    label: overdue
                        ? l10n.installmentStatusOverdue
                        : l10n.installmentDueOn(
                            DateFormatter.mediumDate(
                              next!.dueDate,
                              languageCode: lang,
                            ),
                          ),
                    tone: overdue ? BadgeTone.error : BadgeTone.gold,
                    dot: true,
                  ),
                ],
              )
            : Row(
                children: [
                  IconChip(
                    icon: Icons.check_circle_rounded,
                    tone: AppTone.success,
                    size: IconChipSize.sm,
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
              ),
      ),
    );
  }
}

// ── 2 · My property card ────────────────────────────────────────────────────

/// The owned asset, presented as one premium card: project, unit, key contract
/// details, and inline service actions. Mirrors the web PropertyFocus asset
/// panel, sized for mobile.
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

// ── 3 · Priority summary (live counts) ──────────────────────────────────────

class _PrioritySummary extends StatelessWidget {
  const _PrioritySummary({
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppSectionHeader(title: l10n.dashboardOverview),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: SummaryTile(
                icon: AppIcons.installments,
                value: '$unpaidCount',
                label: l10n.homeDuePaymentsLabel,
                subtitle: overdueCount > 0
                    ? '${l10n.installmentStatusOverdue}: $overdueCount'
                    : null,
                tone: overdueCount > 0 ? AppTone.error : AppTone.gold,
                loading: installmentsLoading,
                onTap: () => context.push('/account/installments'),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child:
                  BlocBuilder<
                    MaintenanceRequestsCubit,
                    MaintenanceRequestsState
                  >(
                    builder: (context, state) {
                      final open = (state.data ?? const <MaintenanceRequest>[])
                          .where((r) => _isOpen(r.status))
                          .length;
                      return SummaryTile(
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
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: BlocBuilder<UnreadCountCubit, int>(
                builder: (context, count) => SummaryTile(
                  icon: AppIcons.notification,
                  value: '$count',
                  label: l10n.accountNotifications,
                  onTap: () => context.push('/account/notifications'),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: BlocBuilder<FavoritesCubit, FavoritesState>(
                builder: (context, state) => SummaryTile(
                  icon: AppIcons.favorite,
                  value: '${state.items.length}',
                  label: l10n.accountFavorites,
                  loading: state.status == DataStatus.loading,
                  onTap: () => context.push('/account/favorites'),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  static bool _isOpen(MaintenanceStatus s) =>
      s == MaintenanceStatus.open ||
      s == MaintenanceStatus.assigned ||
      s == MaintenanceStatus.inProgress;
}

// ── 4 · Quick actions (compact) ─────────────────────────────────────────────

class _QuickActionItem {
  const _QuickActionItem(this.icon, this.tone, this.label, this.route);
  final IconData icon;
  final AppTone tone;
  final String label;
  final String route;
}

class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    final items = <_QuickActionItem>[
      _QuickActionItem(
        AppIcons.property,
        AppTone.gold,
        l10n.accountMyProperty,
        '/account/property',
      ),
      _QuickActionItem(
        AppIcons.contract,
        AppTone.navy,
        l10n.accountContracts,
        '/account/contracts',
      ),
      _QuickActionItem(
        AppIcons.deposit,
        AppTone.gold,
        l10n.accountDeposits,
        '/account/deposits',
      ),
      _QuickActionItem(
        AppIcons.visit,
        AppTone.navy,
        l10n.navVisits,
        '/account/requests',
      ),
    ];

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
          // Compact rows — wide, short tap targets (no wasted whitespace).
          childAspectRatio: 3.4,
          children: [
            for (final a in items)
              PremiumCard(
                elevation: AppCardElevation.soft,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                onTap: () => context.push(a.route),
                child: Row(
                  children: [
                    IconChip(icon: a.icon, tone: a.tone, size: IconChipSize.sm),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        a.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: context.appColors.inkStrong,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
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

// ── 5 · Recent activity ─────────────────────────────────────────────────────

/// Latest maintenance updates (max 3), shown before discovery. Hides entirely
/// when there's nothing to show. Uses the maintenance cubit already loaded for
/// the priority summary — no extra fetch.
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
