import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/role_label.dart';
import '../../../auth/presentation/cubit/staff_auth_cubit.dart';
import '../../../bonus/presentation/cubit/bonus_summary_cubit.dart';
import '../../../performance/presentation/cubit/target_summary_cubit.dart';
import '../../../performance/presentation/widgets/target_progress_card.dart';
import '../cubit/staff_profile_cubit.dart';

/// Staff profile: identity + role, language/theme controls, and logout.
class StaffProfileScreen extends StatefulWidget {
  const StaffProfileScreen({super.key});

  @override
  State<StaffProfileScreen> createState() => _StaffProfileScreenState();
}

class _StaffProfileScreenState extends State<StaffProfileScreen> {
  @override
  void initState() {
    super.initState();
    context.read<StaffProfileCubit>().load();
    context.read<TargetSummaryCubit>().load();
    context.read<BonusSummaryCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    // P11.6 — payment review entry for ADMIN + SALES_MANAGER only.
    final role = context.read<SessionCubit>().state.role;
    final canReviewPayments = role == AppRole.admin || role == AppRole.salesManager;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.navProfile)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          BlocBuilder<StaffProfileCubit, StaffProfileState>(
            builder: (context, state) {
              switch (state.status) {
                case DataStatus.initial:
                case DataStatus.loading:
                  return const _ProfileHeaderSkeleton();
                case DataStatus.failure:
                  return ErrorState(
                    failure: state.failure,
                    onRetry: () => context.read<StaffProfileCubit>().load(),
                  );
                case DataStatus.empty:
                case DataStatus.success:
                  final p = state.data;
                  final session = context.read<SessionCubit>().state.sessionOrNull;
                  final name = p?.fullName ?? session?.displayName ?? '—';
                  final email = p?.email ?? session?.email;
                  final role = p?.role ?? session?.role ?? AppRole.sales;
                  return AppCard(
                    elevation: AppCardElevation.soft,
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 28,
                          backgroundColor: colors.brandGoldSoft,
                          child: Icon(Icons.person, color: colors.brandGold),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(name, style: Theme.of(context).textTheme.titleMedium),
                              if (email != null) ...[
                                const SizedBox(height: 2),
                                Text(email,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(color: colors.inkMuted)),
                              ],
                              const SizedBox(height: AppSpacing.xs),
                              StatusBadge(label: roleLabel(l10n, role), tone: BadgeTone.navy),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
              }
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          const _PerformanceSection(),
          if (canReviewPayments)
            _SettingTile(
              icon: Icons.receipt_long_rounded,
              label: l10n.paymentReviewTitle,
              onTap: () => context.push('/payments-review'),
            ),
          _SettingTile(
            icon: Icons.translate_rounded,
            label: l10n.settingsLanguage,
            trailing: Text(l10n.languageName),
            onTap: () => context.read<LocaleCubit>().toggle(),
          ),
          _SettingTile(
            icon: Icons.brightness_6_outlined,
            label: l10n.settingsTheme,
            onTap: () => context.read<ThemeCubit>().cycle(),
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: l10n.actionLogout,
            icon: Icons.logout_rounded,
            variant: AppButtonVariant.outline,
            expand: true,
            onPressed: () => context.read<StaffAuthCubit>().logout(),
          ),
        ],
      ),
    );
  }
}

/// Best-effort performance section: target progress + a compact activity row +
/// a bonus mini-line. Hidden entirely when both summaries are unavailable
/// (e.g. the rep lacks targets/bonus permissions).
class _PerformanceSection extends StatelessWidget {
  const _PerformanceSection();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;

    return BlocBuilder<TargetSummaryCubit, TargetSummaryState>(
      builder: (context, target) {
        return BlocBuilder<BonusSummaryCubit, BonusSummaryState>(
          builder: (context, bonus) {
            final targetReady = target.status == TargetSummaryStatus.ready;
            final bonusReady = bonus.status == SummaryStatus.ready;
            if (!targetReady && !bonusReady) return const SizedBox.shrink();
            final perf = target.performance;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.profilePerformance, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: AppSpacing.sm),
                if (targetReady && perf != null) ...[
                  AppCard(
                    child: Row(
                      children: [
                        Expanded(child: _Stat(label: l10n.profileActiveLeads, value: '${perf.openLeadsCount}')),
                        Expanded(child: _Stat(label: l10n.navVisits, value: '${perf.visitsCount}')),
                        Expanded(child: _Stat(label: l10n.navReservations, value: '${perf.reservationsCount}')),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TargetProgressCard(performance: perf),
                ],
                if (bonusReady && bonus.overview != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  AppCard(
                    child: Row(
                      children: [
                        Icon(Icons.payments_outlined, color: colors.brandGold, size: 20),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(child: Text(l10n.bonusTitle, style: Theme.of(context).textTheme.titleSmall)),
                        Text(
                          '${l10n.bonusPaid}: ${PriceFormatter.format(bonus.overview!.paidTotal, languageCode: lang)}',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
              ],
            );
          },
        );
      },
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(
      children: [
        Text(value, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 2),
        Text(label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.inkMuted)),
      ],
    );
  }
}

class _SettingTile extends StatelessWidget {
  const _SettingTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: AppCard(
        onTap: onTap,
        child: Row(
          children: [
            Icon(icon, color: colors.brandGold),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: Text(label, style: Theme.of(context).textTheme.titleSmall)),
            ?trailing,
          ],
        ),
      ),
    );
  }
}

class _ProfileHeaderSkeleton extends StatelessWidget {
  const _ProfileHeaderSkeleton();

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: AppCard(
        child: Row(
          children: [
            const CircleAvatar(radius: 28),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Staff Member', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text('staff@example.com',
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
