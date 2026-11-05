import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/plan_banner.dart';
import '../../notifications/presentation/widgets/customer_notification_button.dart';
import '../domain/entities/property.dart';
import 'my_property_cubit.dart';

const _navyDeep = Color(0xFF0B1726);

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
// My Property Screen
// ─────────────────────────────────────────────────────────────────────────────

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
    final session = context.watch<SessionCubit>().state;
    final displayName =
        session.sessionOrNull?.displayName ?? session.sessionOrNull?.email;

    return BlocBuilder<MyPropertyCubit, MyPropertyState>(
      builder: (context, state) {
        final l10n = context.l10n;

        final properties =
            state.status == DataStatus.success ? state.data! : const <Property>[];
        final ownedCount =
            properties.where((p) => p.status == PropertyStatus.owned).length;

        return Column(
          children: [
            _MyPropertyHeader(
              displayName: displayName,
              totalCount: properties.length,
              ownedCount: ownedCount,
              showCount: state.status == DataStatus.success,
            ),
            Expanded(
              child: switch (state.status) {
                DataStatus.initial || DataStatus.loading => const _PropertySkeleton(),
                DataStatus.failure => ErrorState(
                    failure: state.failure,
                    onRetry: () => context.read<MyPropertyCubit>().load(),
                  ),
                DataStatus.empty => EmptyState(
                    icon: Icons.home_work_outlined,
                    title: l10n.myPropertyEmptyTitle,
                    message: l10n.myPropertyEmptyMessage,
                  ),
                DataStatus.success => RefreshIndicator(
                    onRefresh: () => context.read<MyPropertyCubit>().load(),
                    child: ListView.builder(
                      padding: EdgeInsets.fromLTRB(
                        AppSpacing.lg,
                        AppSpacing.md,
                        AppSpacing.lg,
                        AppSpacing.lg + MediaQuery.of(context).padding.bottom,
                      ),
                      itemCount: properties.length,
                      itemBuilder: (context, i) => Padding(
                        padding: EdgeInsets.only(
                          bottom: i < properties.length - 1 ? AppSpacing.lg : 0,
                        ),
                        child: GestureDetector(
                          onTap: () => context.push(
                            '/account/property/detail',
                            extra: properties[i],
                          ),
                          child: _PropertyCard(property: properties[i], index: i),
                        ).animate(delay: Duration(milliseconds: 70 * i))
                            .fadeIn(duration: 360.ms)
                            .slideY(
                              begin: 0.06,
                              end: 0,
                              duration: 360.ms,
                              curve: Curves.easeOut,
                            ),
                      ),
                    ),
                  ),
              },
            ),
          ],
        );
      },
    );
  }
}

// ── Premium screen header ─────────────────────────────────────────────────────

class _MyPropertyHeader extends StatelessWidget {
  const _MyPropertyHeader({
    required this.displayName,
    required this.totalCount,
    required this.ownedCount,
    required this.showCount,
  });

  final String? displayName;
  final int totalCount;
  final int ownedCount;
  final bool showCount;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppNavHeader(
      title: showCount && totalCount > 1 ? l10n.myUnits : l10n.accountMyProperty,
      subtitle: l10n.myPortfolio,
      compact: true,
      leadingAction: GestureDetector(
        onTap: () => context.push('/account/profile'),
        child: _GoldRingAvatar(name: displayName),
      ),
      actions: const [CustomerNotificationButton()],
      bottom: showCount
          ? Align(
              alignment: AlignmentDirectional.centerStart,
              child: _PortfolioPill(totalCount: totalCount, ownedCount: ownedCount, l10n: l10n),
            )
          : null,
    );
  }
}

class _GoldRingAvatar extends StatelessWidget {
  const _GoldRingAvatar({required this.name});
  final String? name;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.75),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.26),
            blurRadius: 14,
            spreadRadius: 1,
          ),
        ],
      ),
      child: GradientAvatar(name: name, size: 48),
    );
  }
}

class _PortfolioPill extends StatelessWidget {
  const _PortfolioPill({
    required this.totalCount,
    required this.ownedCount,
    required this.l10n,
  });

  final int totalCount;
  final int ownedCount;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final pendingCount = totalCount - ownedCount;

    return Wrap(
      spacing: 6,
      runSpacing: 4,
      children: [
        // Gold count pill
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFC8A24B), AppPalette.gold500],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(999),
            boxShadow: [
              BoxShadow(
                color: AppPalette.gold400.withValues(alpha: 0.28),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            context.l10n.unitsCount(totalCount),
            style: const TextStyle(
              color: _navyDeep,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        // Owned chip — only visible when there's a mix of statuses
        if (ownedCount > 0 && pendingCount > 0)
          _StatusMiniChip(
            color: const Color(0xFF34C77B),
            label: l10n.myPropertyStatusOwned,
            count: ownedCount,
          ),
        if (pendingCount > 0 && ownedCount > 0)
          _StatusMiniChip(
            color: AppPalette.gold400,
            label: l10n.myPropertyStatusReserved,
            count: pendingCount,
          ),
      ],
    );
  }
}

class _StatusMiniChip extends StatelessWidget {
  const _StatusMiniChip({
    required this.color,
    required this.label,
    required this.count,
  });

  final Color color;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 4),
          Text(
            '$count $label',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.78),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

class _PropertySkeleton extends StatelessWidget {
  const _PropertySkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AppSkeletonizer(
      enabled: true,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.lg),
        itemCount: 2,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
        itemBuilder: (_, _) => Container(
          height: 270,
          decoration: BoxDecoration(
            color: colors.surfaceSoft,
            borderRadius: BorderRadius.circular(20),
          ),
        ),
      ),
    );
  }
}

// ── Property card ─────────────────────────────────────────────────────────────

class _PropertyCard extends StatelessWidget {
  const _PropertyCard({required this.property, required this.index});

  final Property property;
  final int index;

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
    ];

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 22,
            offset: const Offset(0, 6),
          ),
          if (owned)
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.07),
              blurRadius: 28,
              spreadRadius: 2,
              offset: const Offset(0, 4),
            ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CardHeader(
            projectName: property.projectName.resolve(lang),
            unitType: unitTypeLabel(property.unitType, languageCode: lang),
            unitCode: property.unitCode,
            owned: owned,
            index: index,
            l10n: l10n,
          ),
          Divider(height: 1, indent: AppSpacing.lg, endIndent: AppSpacing.lg, color: colors.hairline),
          if (stats.isNotEmpty) _StatsBlock(stats: stats, colors: colors),
          if (property.hasInstallmentPlan)
            _InstallmentBanner(property: property, lang: lang, l10n: l10n),
          _ActionRow(property: property, l10n: l10n),
        ],
      ),
    );
  }
}

// ── Card header ───────────────────────────────────────────────────────────────

class _CardHeader extends StatelessWidget {
  const _CardHeader({
    required this.projectName,
    required this.unitType,
    required this.unitCode,
    required this.owned,
    required this.index,
    required this.l10n,
  });

  final String projectName;
  final String unitType;
  final String unitCode;
  final bool owned;
  final int index;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;

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
                  '$unitType · $unitCode',
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
          const SizedBox(width: AppSpacing.sm),
          _StatusPill(owned: owned, l10n: l10n),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.owned, required this.l10n});
  final bool owned;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ownedColor = dark ? const Color(0xFF4ADE80) : const Color(0xFF15803D);
    final reservedColor = dark ? AppPalette.gold300 : const Color(0xFF9A6F1E);
    final dotColor = owned ? ownedColor : reservedColor;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: dotColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: dotColor.withValues(alpha: 0.40)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            owned
                ? l10n.myPropertyStatusOwned
                : l10n.myPropertyStatusReserved,
            style: TextStyle(
              color: dotColor,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Stats block ───────────────────────────────────────────────────────────────

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
        vertical: 4,
      ),
      child: Column(
        children: [
          for (var i = 0; i < stats.length; i++) ...[
            if (i > 0) Divider(height: 1, color: colors.hairline),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  Text(
                    stats[i].label,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colors.inkMuted,
                      fontSize: 13,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    stats[i].value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
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

class _Stat {
  const _Stat(this.label, this.value);
  final String label;
  final String value;
}

// ── Installment banner ────────────────────────────────────────────────────────

class _InstallmentBanner extends StatelessWidget {
  const _InstallmentBanner({
    required this.property,
    required this.lang,
    required this.l10n,
  });

  final Property property;
  final String lang;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final secondary = lang == 'ar'
        ? 'شهريًا · ${property.totalMonths} شهرًا'
        : 'mo · ${property.totalMonths} months';
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, 6),
      child: PlanBanner(
        labelText:     l10n.myPropertyInstallmentPlan,
        amountText:    _compact(property.monthlyAmount ?? '0', lang),
        secondaryText: secondary,
      ),
    );
  }
}

// ── Action row ────────────────────────────────────────────────────────────────

class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.property, required this.l10n});
  final Property property;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.hairline)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: _ActionButton(
              icon: AppIcons.contract,
              label: l10n.accountContracts,
              navy: false,
              onTap: () => context.push('/account/contracts'),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: _ActionButton(
              icon: AppIcons.maintenance,
              label: l10n.myPropertyRequestMaintenance,
              navy: true,
              onTap: () => context.push(
                '/account/maintenance/new',
                extra: {'unitId': property.unitId},
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.navy,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool navy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadii.lg),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        splashColor: navy
            ? AppPalette.gold400.withValues(alpha: 0.10)
            : colors.hairline.withValues(alpha: 0.5),
        child: Container(
          height: 44,
          decoration: BoxDecoration(
            color: navy
                ? AppPalette.gold400.withValues(alpha: 0.10)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: navy
                ? Border.all(color: AppPalette.gold400.withValues(alpha: 0.35))
                : Border.all(color: colors.hairline.withValues(alpha: 0.8)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 17,
                color: navy ? AppPalette.gold500 : colors.inkStrong,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: navy ? AppPalette.gold600 : colors.inkStrong,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
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
