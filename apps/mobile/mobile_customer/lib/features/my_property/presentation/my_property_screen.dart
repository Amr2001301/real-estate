import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/entities/property.dart';
import 'my_property_cubit.dart';

/// Authenticated "My Property" screen: summarizes each unit a customer owns or
/// has reserved (derived from their contracts) with ownership status, key
/// dates, and quick links to deposits, contracts, maintenance, and contact.
class MyPropertyScreen extends StatefulWidget {
  const MyPropertyScreen({super.key});

  @override
  State<MyPropertyScreen> createState() => _MyPropertyScreenState();
}

class _MyPropertyScreenState extends State<MyPropertyScreen> {
  @override
  void initState() {
    super.initState();
    context.read<MyPropertyCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // Body-only: the CustomerShellScaffold supplies the app bar + bottom nav.
    return BlocBuilder<MyPropertyCubit, MyPropertyState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return const _PropertySkeleton();
          case DataStatus.failure:
            return ErrorState(
              failure: state.failure,
              onRetry: () => context.read<MyPropertyCubit>().load(),
            );
          case DataStatus.empty:
            return EmptyState(
              icon: Icons.home_work_outlined,
              title: l10n.myPropertyEmptyTitle,
              message: l10n.myPropertyEmptyMessage,
            );
          case DataStatus.success:
            final properties = state.data!;
            return RefreshIndicator(
              onRefresh: () => context.read<MyPropertyCubit>().load(),
              child: ListView.separated(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.lg + MediaQuery.of(context).padding.bottom,
                ),
                itemCount: properties.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(height: AppSpacing.lg),
                itemBuilder: (context, i) =>
                    _PropertyCard(property: properties[i]),
              ),
            );
        }
      },
    );
  }
}

/// Loading placeholder mirroring the property cards — shimmering bones instead
/// of a bare spinner, matching the Guest loading language.
class _PropertySkeleton extends StatelessWidget {
  const _PropertySkeleton();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppSkeletonizer(
      enabled: true,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.lg),
        itemCount: 2,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
        itemBuilder: (context, _) => AppCard(
          elevation: AppCardElevation.soft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Project name placeholder',
                          style: theme.textTheme.titleMedium,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Unit type · code',
                          style: theme.textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  const StatusBadge(label: '••••', tone: BadgeTone.neutral),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              const Divider(height: 1),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Detail line placeholder',
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Detail line placeholder',
                style: theme.textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PropertyCard extends StatelessWidget {
  const _PropertyCard({required this.property});

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
          l10n.myPropertyInstallmentPlan,
          l10n.myPropertyInstallmentSummary(
            PriceFormatter.formatString(
              property.monthlyAmount,
              languageCode: lang,
            ),
            property.totalMonths!,
          ),
        ),
    ];

    return PremiumCard(
      glow: true,
      accentRail: AppTone.gold,
      padding: const EdgeInsets.all(AppSpacing.lg),
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

          // Contract facts — clean, aligned key/value table.
          if (stats.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(color: colors.hairline),
                  bottom: BorderSide(color: colors.hairline),
                ),
              ),
              child: Column(
                children: [for (final s in stats) _StatRow(stat: s)],
              ),
            ),
          ],

          // Two clean actions, matching the web property card.
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: l10n.accountContracts,
                  icon: AppIcons.contract,
                  variant: AppButtonVariant.outline,
                  size: AppButtonSize.medium,
                  onPressed: () => context.push('/account/contracts'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppButton(
                  label: l10n.myPropertyRequestMaintenance,
                  icon: AppIcons.maintenance,
                  variant: AppButtonVariant.primary,
                  size: AppButtonSize.medium,
                  onPressed: () => context.push(
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

/// Aligned key → value row used in the contract-facts table.
class _StatRow extends StatelessWidget {
  const _StatRow({required this.stat});
  final _Stat stat;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Text(
            stat.label,
            style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              stat.value,
              textAlign: TextAlign.end,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: colors.inkStrong,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
