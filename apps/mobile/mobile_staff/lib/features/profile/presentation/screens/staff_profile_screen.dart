import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/role_label.dart';
import '../../../auth/presentation/cubit/staff_auth_cubit.dart';
import '../../../bonus/presentation/cubit/bonus_summary_cubit.dart';
import '../../../dashboard/home_kit/home_kit.dart';
import '../../../performance/domain/entities/sales_performance.dart';
import '../../../performance/presentation/cubit/target_summary_cubit.dart';
import '../../../permissions/staff_permissions.dart';
import '../cubit/staff_profile_cubit.dart';
import '../profile_kit.dart';

void _showComingSoon(BuildContext context) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(context.l10n.placeholderScreen),
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 2),
    ),
  );
}

/// The staff profile (owner-approved look, 2026-11): the person on the navy
/// hero, the main shortcuts, then the sections each role may open, the
/// month's figures, and the account (notifications, security, language,
/// theme, support, sign out).
class StaffProfileScreen extends StatefulWidget {
  const StaffProfileScreen({super.key, this.onSwitchTab});
  final void Function(int)? onSwitchTab;

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

  Future<void> _confirmLogout(BuildContext context) async {
    final l10n = context.l10n;
    final ok = await showAdaptiveConfirm(
      context,
      title: l10n.actionLogout,
      message: l10n.logoutConfirmMessage,
      confirmLabel: l10n.actionLogout,
      cancelLabel: l10n.actionCancel,
      destructive: true,
    );
    if (ok && context.mounted) context.read<StaffAuthCubit>().logout();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final role = context.read<SessionCubit>().state.role;
    final perms = context.watch<StaffPermissionsCubit>().state;
    final canReviewPayments = StaffAccess.paymentsReview(role, perms);
    final clients = StaffAccess.clients(role, perms);

    return Scaffold(
      backgroundColor: context.appColors.canvas,
      body: ListView(
        key: const Key('staff-profile'),
        padding: EdgeInsets.only(bottom: bottom + 32),
        children: [
          BlocBuilder<StaffProfileCubit, StaffProfileState>(
            builder: (context, state) {
              final session = context.read<SessionCubit>().state.sessionOrNull;
              final ok = state.status == DataStatus.success;
              final name = (ok ? state.data?.fullName : null) ?? session?.displayName ?? '';
              final roleVal = (ok ? state.data?.role : null) ?? session?.role ?? AppRole.sales;
              return ProfileHero(name: name, subtitle: roleLabel(l10n, roleVal));
            },
          ),
          HomeActions(actions: [
            HomeAction(id: 'targets', icon: Icons.track_changes_rounded, label: l10n.staffShortcutPerformance, onTap: () => context.push('/targets')),
            HomeAction(id: 'visits', icon: AppIcons.visit, label: l10n.staffShortcutVisits, onTap: () => context.push('/visits')),
            if (clients) HomeAction(id: 'clients', icon: AppIcons.profile, label: l10n.staffShortcutClients, onTap: () => context.push('/clients')),
            HomeAction(id: 'bonus', icon: Icons.payments_rounded, label: l10n.staffShortcutCommissions, onTap: () => context.push('/bonus')),
          ]),
          ProfileSection(
            icon: Icons.work_outline_rounded,
            title: l10n.staffSectionTools,
            items: [
              if (clients)
                ProfileItem(
                    id: 'clients', icon: AppIcons.profile, label: l10n.navClients, subtitle: l10n.staffMyClientsDesc, onTap: () => context.push('/clients')),
              ProfileItem(
                  id: 'leads',
                  icon: Icons.people_alt_rounded,
                  label: l10n.navLeads,
                  subtitle: l10n.staffMyLeadsDesc,
                  onTap: () => widget.onSwitchTab?.call(1)),
              ProfileItem(
                  id: 'targets',
                  icon: Icons.track_changes_rounded,
                  label: l10n.targetsTitle,
                  subtitle: l10n.staffMyTargetsDesc,
                  onTap: () => context.push('/targets')),
              if (StaffAccess.inquiries(role, perms))
                ProfileItem(
                    id: 'inquiries',
                    icon: Icons.question_answer_rounded,
                    label: l10n.inqTitle,
                    subtitle: l10n.inqProfileDesc,
                    onTap: () => context.push('/inquiries')),
              ProfileItem(
                  id: 'bonus', icon: Icons.payments_rounded, label: l10n.bonusTitle, subtitle: l10n.staffMyBonusDesc, onTap: () => context.push('/bonus')),
              ProfileItem(
                  id: 'visits', icon: AppIcons.visit, label: l10n.navVisits, subtitle: l10n.staffMyVisitsDesc, onTap: () => context.push('/visits')),
            ],
          ),
          ProfileSection(
            icon: Icons.storefront_rounded,
            title: l10n.staffSectionOperations,
            items: [
              ProfileItem(
                  id: 'reservations',
                  icon: Icons.bookmark_added_rounded,
                  label: l10n.navReservations,
                  subtitle: l10n.staffMyReservationsDesc,
                  onTap: () => context.push('/reservations')),
              ProfileItem(
                  id: 'contracts',
                  icon: Icons.description_rounded,
                  label: l10n.navContracts,
                  subtitle: l10n.staffMyContractsDesc,
                  onTap: () => context.push('/contracts')),
              ProfileItem(
                  id: 'projects',
                  icon: Icons.apartment_rounded,
                  label: l10n.navProjects,
                  subtitle: l10n.staffMyInventoryDesc,
                  onTap: () => context.push('/projects')),
              ProfileItem(
                  id: 'units',
                  icon: Icons.door_front_door_rounded,
                  label: l10n.navUnits,
                  subtitle: l10n.cuProfileDesc,
                  onTap: () => context.push('/units')),
              ProfileItem(
                  id: 'plans',
                  icon: Icons.calculate_rounded,
                  label: l10n.planTemplatesTitle,
                  subtitle: l10n.staffMyCalculatorDesc,
                  onTap: () => context.push('/installment-plans')),
            ],
          ),
          ProfileSection(
            icon: Icons.fact_check_outlined,
            title: l10n.profileSectionAdmin,
            items: [
              if (canReviewPayments)
                ProfileItem(
                    id: 'payments-review',
                    icon: Icons.receipt_long_rounded,
                    label: l10n.paymentReviewTitle,
                    onTap: () => context.push('/payments-review')),
              // The brokers' performance report is the admin's.
              if (StaffAccess.reports(role, perms))
                ProfileItem(
                    id: 'reports',
                    icon: Icons.bar_chart_rounded,
                    label: l10n.rpTitle,
                    subtitle: l10n.rpProfileDesc,
                    onTap: () => context.push('/reports')),
              if (StaffAccess.financialReport(role, perms))
                ProfileItem(
                    id: 'financial-report',
                    icon: Icons.account_balance_wallet_rounded,
                    label: l10n.frTitle,
                    subtitle: l10n.frProfileDesc,
                    onTap: () => context.push('/reports/financial')),
              if (StaffAccess.brokers(role, perms))
                ProfileItem(
                    id: 'brokers-hub',
                    icon: Icons.storefront_rounded,
                    label: l10n.brkTitle,
                    subtitle: l10n.brkProfileDesc,
                    onTap: () => context.push('/company-brokers')),
              if (role == AppRole.admin)
                ProfileItem(id: 'brokers', icon: Icons.handshake_rounded, label: l10n.bpTitle, onTap: () => context.push('/performance/brokers')),
            ],
          ),
          BlocBuilder<TargetSummaryCubit, TargetSummaryState>(
            builder: (context, target) {
              if (target.status != TargetSummaryStatus.ready || target.performance == null) return const SizedBox.shrink();
              return HomeSection(
                icon: Icons.insights_rounded,
                title: l10n.profilePerformance,
                child: _Kpis(perf: target.performance!),
              );
            },
          ),
          ProfileSection(
            icon: Icons.shield_outlined,
            title: l10n.profileSectionAccount,
            items: [
              ProfileItem(
                  id: 'notifications', icon: AppIcons.notification, label: l10n.accountNotifications, onTap: () => context.push('/notifications')),
              // Devices, two-step sign-in, password.
              ProfileItem(id: 'security', icon: Icons.lock_outline_rounded, label: l10n.settingsSecurity, onTap: () => context.push('/security')),
              ProfileItem(
                  id: 'language',
                  icon: Icons.translate_rounded,
                  label: l10n.settingsLanguage,
                  trailing: l10n.languageName,
                  onTap: () => context.read<LocaleCubit>().toggle()),
              ProfileItem(
                  id: 'theme', icon: Icons.brightness_6_outlined, label: l10n.settingsTheme, onTap: () => context.read<ThemeCubit>().cycle()),
              ProfileItem(id: 'support', icon: Icons.help_outline_rounded, label: l10n.settingsSupport, onTap: () => _showComingSoon(context)),
            ],
          ),
          ProfileLogout(label: l10n.actionLogout, onTap: () => _confirmLogout(context)),
        ],
      ),
    );
  }
}

/// The month's figures: open leads, visits, bookings and the target.
class _Kpis extends StatelessWidget {
  const _Kpis({required this.perf});
  final SalesPerformance perf;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final pct = perf.targetAmountPercent;
    final cells = <(String, String, Color)>[
      ('${perf.openLeadsCount}', l10n.profileActiveLeads, AppPalette.gold500),
      ('${perf.visitsCount}', l10n.navVisits, colors.info),
      ('${perf.reservationsCount}', l10n.navReservations, colors.success),
      if (pct != null) ('${pct.clamp(0, 999).toStringAsFixed(0)}%', l10n.targetsActivity, pct >= 100 ? colors.success : colors.warning),
    ];
    return Container(
      decoration: homeCard(context, radius: 24),
      child: IntrinsicHeight(
        child: Row(children: [
          for (var i = 0; i < cells.length; i++) ...[
            if (i > 0) VerticalDivider(width: 1, thickness: 1, color: colors.hairline),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(ltr(cells[i].$1), style: homeDisplay(21, cells[i].$3)),
                  const SizedBox(height: 4),
                  Text(cells[i].$2, textAlign: TextAlign.center, maxLines: 2, style: TextStyle(fontSize: 10.5, color: colors.inkMuted, height: 1.3)),
                ]),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}
