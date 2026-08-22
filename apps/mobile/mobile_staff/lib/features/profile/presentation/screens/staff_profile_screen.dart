import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/role_label.dart';
import '../../../auth/presentation/cubit/staff_auth_cubit.dart';
import '../../../bonus/presentation/cubit/bonus_summary_cubit.dart';
import '../../../performance/domain/entities/sales_performance.dart';
import '../../../performance/presentation/cubit/target_summary_cubit.dart';
import '../cubit/staff_profile_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

void _showComingSoon(BuildContext context) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(context.l10n.placeholderScreen),
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 2),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff Profile Screen — mirrors the Customer Account screen rhythm
// ─────────────────────────────────────────────────────────────────────────────

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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final sessionRole = context.read<SessionCubit>().state.role;
    final canReviewPayments =
        sessionRole == AppRole.admin || sessionRole == AppRole.salesManager;

    return Scaffold(
      body: Column(
        children: [
          // Custom full-bleed navy header
          BlocBuilder<StaffProfileCubit, StaffProfileState>(
            builder: (context, state) {
              final session = context.read<SessionCubit>().state.sessionOrNull;
              final name =
                  (state.status == DataStatus.success
                          ? state.data?.fullName
                          : null) ??
                  session?.displayName ??
                  '';
              final roleVal =
                  (state.status == DataStatus.success
                          ? state.data?.role
                          : null) ??
                  session?.role ??
                  AppRole.sales;
              return _StaffAccountHeader(name: name, roleVal: roleVal);
            },
          ),
          // Scrollable body
          Expanded(
            child: ListView(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.xl + bottomPad,
              ),
              children: [
                // ── Quick access shortcuts ────────────────────────────────
                _StaffQuickBar(l10n: l10n, onSwitchTab: widget.onSwitchTab),
                const SizedBox(height: AppSpacing.xl),

                // ── أدوات المستشار (service rows) ─────────────────────────
                _SectionLabel(title: l10n.staffSectionTools),
                const SizedBox(height: AppSpacing.sm),
                _StaffServicesCard(l10n: l10n, onSwitchTab: widget.onSwitchTab),
                const SizedBox(height: AppSpacing.xl),

                // ── Compact performance card ──────────────────────────────
                BlocBuilder<TargetSummaryCubit, TargetSummaryState>(
                  builder: (context, target) {
                    if (target.status != TargetSummaryStatus.ready ||
                        target.performance == null) {
                      return const SizedBox.shrink();
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _SectionLabel(title: l10n.profilePerformance),
                        const SizedBox(height: AppSpacing.sm),
                        _CompactKpiCard(perf: target.performance!),
                        const SizedBox(height: AppSpacing.xl),
                      ],
                    );
                  },
                ),

                // ── الإعدادات ─────────────────────────────────────────────
                _SectionLabel(title: l10n.accountSectionSettings),
                const SizedBox(height: AppSpacing.sm),
                _SettingsToggleRow(l10n: l10n),
                const SizedBox(height: AppSpacing.sm),
                _SettingsServicesCard(
                  l10n: l10n,
                  canReviewPayments: canReviewPayments,
                ),
                const SizedBox(height: AppSpacing.xl),

                // ── تسجيل الخروج ──────────────────────────────────────────
                _LogoutButton(
                  label: l10n.actionLogout,
                  onTap: () => _confirmLogout(context),
                ),
              ],
            ),
          ),
        ],
      ),
    );
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
}

// ── Custom navy header (mirrors _AccountHeader from customer app) ──────────────

class _StaffAccountHeader extends StatelessWidget {
  const _StaffAccountHeader({required this.name, required this.roleVal});
  final String name;
  final AppRole roleVal;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [_navyLight, _navyCard, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(32),
            bottomRight: Radius.circular(32),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x40000000),
              blurRadius: 24,
              offset: Offset(0, 10),
            ),
          ],
        ),
        child: Stack(
          children: [
            const Positioned.fill(child: IgnorePointer(child: _HeaderDots())),
            // Gold radial glow
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 180,
                height: 150,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.09),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            // Gold shimmer bottom line
            Positioned(
              bottom: 0,
              left: 60,
              right: 60,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.0),
                      AppPalette.gold400.withValues(alpha: 0.5),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                topInset + AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Avatar with gold ring
                  _GoldRingAvatar(name: name),
                  const SizedBox(width: AppSpacing.md),
                  // Name + role chip
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.navAccount,
                          style: theme.textTheme.labelSmall?.copyWith(
                            fontSize: 12,
                            color: AppPalette.gold300,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          name.isEmpty ? '—' : name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 8),
                        // Gold gradient role chip
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFFC8A24B), AppPalette.gold500],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(999),
                            boxShadow: [
                              BoxShadow(
                                color: AppPalette.gold400.withValues(alpha: 0.3),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Text(
                            roleLabel(l10n, roleVal),
                            style: const TextStyle(
                              color: _navyDeep,
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Notifications shortcut
                  const SizedBox(width: AppSpacing.sm),
                  GestureDetector(
                    onTap: () => context.push('/notifications'),
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.14),
                        ),
                      ),
                      child: const Icon(
                        Icons.notifications_outlined,
                        size: 22,
                        color: Colors.white,
                      ),
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

// ── Quick access shortcuts (4 tiles) ─────────────────────────────────────────

class _StaffQuickBar extends StatelessWidget {
  const _StaffQuickBar({required this.l10n, this.onSwitchTab});
  final AppLocalizations l10n;
  final void Function(int)? onSwitchTab;

  @override
  Widget build(BuildContext context) {
    final items = [
      _QItem(
        icon: Icons.track_changes_rounded,
        label: l10n.staffShortcutPerformance,
        navyStyle: true,
        onTap: () => context.push('/targets'),
      ),
      _QItem(
        icon: AppIcons.visit,
        label: l10n.staffShortcutVisits,
        navyStyle: false,
        onTap: () => context.push('/visits'),
      ),
      _QItem(
        icon: AppIcons.profile,
        label: l10n.staffShortcutClients,
        navyStyle: true,
        onTap: () => onSwitchTab?.call(2),
      ),
      _QItem(
        icon: Icons.payments_rounded,
        label: l10n.staffShortcutCommissions,
        navyStyle: false,
        onTap: () => context.push('/bonus'),
      ),
    ];

    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: AppSpacing.sm),
          Expanded(child: _QuickTile(item: items[i])),
        ],
      ],
    );
  }
}

class _QItem {
  const _QItem({
    required this.icon,
    required this.label,
    required this.navyStyle,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final bool navyStyle;
  final VoidCallback onTap;
}

class _QuickTile extends StatelessWidget {
  const _QuickTile({required this.item});
  final _QItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: item.onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: colors.hairline.withValues(alpha: 0.55)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(
            vertical: AppSpacing.md + 2,
            horizontal: AppSpacing.xs,
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      gradient: item.navyStyle
                          ? const LinearGradient(
                              colors: [_navyLight, _navyDeep],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : LinearGradient(
                              colors: [
                                AppPalette.gold300.withValues(alpha: 0.9),
                                AppPalette.gold500,
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      item.icon,
                      size: 19,
                      color: item.navyStyle ? AppPalette.gold300 : _navyDeep,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    item.label,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Section label (gold bar + title) ─────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 3,
          height: 18,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppPalette.gold300, AppPalette.gold500],
            ),
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          title,
          style: theme.textTheme.titleMedium?.copyWith(
            color: colors.inkStrong,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

// ── Staff services list card ──────────────────────────────────────────────────

class _StaffServicesCard extends StatelessWidget {
  const _StaffServicesCard({required this.l10n, this.onSwitchTab});
  final AppLocalizations l10n;
  final void Function(int)? onSwitchTab;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    final services = [
      _SItem(
        icon: AppIcons.profile,
        label: l10n.navClients,
        subtitle: l10n.staffMyClientsDesc,
        navyStyle: true,
        onTap: () => onSwitchTab?.call(2),
      ),
      _SItem(
        icon: Icons.people_alt_rounded,
        label: l10n.navLeads,
        subtitle: l10n.staffMyLeadsDesc,
        navyStyle: false,
        onTap: () => onSwitchTab?.call(1),
      ),
      _SItem(
        icon: Icons.track_changes_rounded,
        label: l10n.targetsTitle,
        subtitle: l10n.staffMyTargetsDesc,
        navyStyle: true,
        onTap: () => context.push('/targets'),
      ),
      _SItem(
        icon: Icons.payments_rounded,
        label: l10n.bonusTitle,
        subtitle: l10n.staffMyBonusDesc,
        navyStyle: false,
        onTap: () => context.push('/bonus'),
      ),
      _SItem(
        icon: AppIcons.visit,
        label: l10n.navVisits,
        subtitle: l10n.staffMyVisitsDesc,
        navyStyle: true,
        onTap: () => context.push('/visits'),
      ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: Column(
          children: [
            for (var i = 0; i < services.length; i++) ...[
              if (i > 0)
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                  ),
                  child: Divider(height: 1, color: colors.hairline),
                ),
              _ServiceRow(item: services[i]),
            ],
          ],
        ),
      ),
    );
  }
}

class _SItem {
  const _SItem({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.navyStyle,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final String subtitle;
  final bool navyStyle;
  final VoidCallback onTap;
}

class _ServiceRow extends StatelessWidget {
  const _ServiceRow({required this.item});
  final _SItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return InkWell(
      onTap: item.onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md + 2,
        ),
        child: Row(
          children: [
            // Icon tile (alternating navy/gold gradient)
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                gradient: item.navyStyle
                    ? const LinearGradient(
                        colors: [_navyLight, _navyDeep],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : const LinearGradient(
                        colors: [Color(0xFFC8A24B), AppPalette.gold500],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(
                item.icon,
                size: 23,
                color: item.navyStyle ? AppPalette.gold300 : _navyDeep,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            // Label + subtitle
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    item.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.subtitle,
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
            // chevron_right auto-mirrors to ‹ in RTL
            Icon(
              AppIcons.chevronForward,
              size: 18,
              color: AppPalette.gold400.withValues(alpha: 0.7),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Compact KPI card ──────────────────────────────────────────────────────────

class _CompactKpiCard extends StatelessWidget {
  const _CompactKpiCard({required this.perf});
  final SalesPerformance perf;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    final achievePct = perf.targetAmountPercent;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            Expanded(
              child: _KpiCell(
                value: '${perf.openLeadsCount}',
                label: l10n.profileActiveLeads,
                color: AppPalette.gold400,
              ),
            ),
            VerticalDivider(width: 1, thickness: 1, color: colors.hairline),
            Expanded(
              child: _KpiCell(
                value: '${perf.visitsCount}',
                label: l10n.navVisits,
                color: colors.info,
              ),
            ),
            VerticalDivider(width: 1, thickness: 1, color: colors.hairline),
            Expanded(
              child: _KpiCell(
                value: '${perf.reservationsCount}',
                label: l10n.navReservations,
                color: colors.success,
              ),
            ),
            if (achievePct != null) ...[
              VerticalDivider(width: 1, thickness: 1, color: colors.hairline),
              Expanded(
                child: _KpiCell(
                  value:
                      '${achievePct.clamp(0, 999).toStringAsFixed(0)}%',
                  label: l10n.targetsActivity,
                  color: achievePct >= 100 ? colors.success : colors.warning,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _KpiCell extends StatelessWidget {
  const _KpiCell({
    required this.value,
    required this.label,
    required this.color,
  });
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.md,
        horizontal: AppSpacing.xs,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: color,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            style: TextStyle(
              fontSize: 10,
              color: colors.inkMuted,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Settings toggle row (2 tiles: language + theme) ───────────────────────────

class _SettingsToggleRow extends StatelessWidget {
  const _SettingsToggleRow({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _SettingsTile(
            icon: Icons.translate_rounded,
            label: l10n.galleryToggleLanguage,
            onTap: () => context.read<LocaleCubit>().toggle(),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: _SettingsTile(
            icon: Icons.brightness_6_outlined,
            label: l10n.galleryToggleTheme,
            onTap: () => context.read<ThemeCubit>().cycle(),
          ),
        ),
      ],
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
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
      color: colors.surface,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: colors.hairline.withValues(alpha: 0.55)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 19, color: colors.inkMuted),
              const SizedBox(width: AppSpacing.xs),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: colors.inkStrong,
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

// ── Settings extended services (notifications, security, support) ─────────────

class _SettingsServicesCard extends StatelessWidget {
  const _SettingsServicesCard({
    required this.l10n,
    required this.canReviewPayments,
  });
  final AppLocalizations l10n;
  final bool canReviewPayments;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    final rows = <_SItem>[
      _SItem(
        icon: AppIcons.notification,
        label: l10n.accountNotifications,
        subtitle: '',
        navyStyle: false,
        onTap: () => context.push('/notifications'),
      ),
      _SItem(
        icon: Icons.lock_outline_rounded,
        label: l10n.settingsSecurity,
        subtitle: '',
        navyStyle: true,
        onTap: () => _showComingSoon(context),
      ),
      _SItem(
        icon: Icons.help_outline_rounded,
        label: l10n.settingsSupport,
        subtitle: '',
        navyStyle: false,
        onTap: () => _showComingSoon(context),
      ),
      if (canReviewPayments)
        _SItem(
          icon: Icons.receipt_long_rounded,
          label: l10n.paymentReviewTitle,
          subtitle: '',
          navyStyle: true,
          onTap: () => context.push('/payments-review'),
        ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: Column(
          children: [
            for (var i = 0; i < rows.length; i++) ...[
              if (i > 0)
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                  ),
                  child: Divider(height: 1, color: colors.hairline),
                ),
              _CompactSettingsRow(item: rows[i]),
            ],
          ],
        ),
      ),
    );
  }
}

class _CompactSettingsRow extends StatelessWidget {
  const _CompactSettingsRow({required this.item});
  final _SItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return InkWell(
      onTap: item.onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: item.navyStyle
                    ? const LinearGradient(
                        colors: [_navyLight, _navyDeep],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : LinearGradient(
                        colors: [
                          AppPalette.gold300.withValues(alpha: 0.85),
                          AppPalette.gold500,
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                item.icon,
                size: 19,
                color: item.navyStyle ? AppPalette.gold300 : _navyDeep,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                item.label,
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Icon(
              AppIcons.chevronForward,
              size: 18,
              color: AppPalette.gold400.withValues(alpha: 0.7),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Logout button (red-tinted, centered) ─────────────────────────────────────

class _LogoutButton extends StatelessWidget {
  const _LogoutButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Material(
      color: colors.error.withValues(alpha: 0.05),
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: colors.error.withValues(alpha: 0.22)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.logout_rounded, size: 18, color: colors.error),
              const SizedBox(width: AppSpacing.sm),
              Text(
                label,
                style: theme.textTheme.titleSmall?.copyWith(
                  color: colors.error,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Shared: gold ring avatar ──────────────────────────────────────────────────

class _GoldRingAvatar extends StatelessWidget {
  const _GoldRingAvatar({required this.name});
  final String name;

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

// ── Shared: dot texture ───────────────────────────────────────────────────────

class _HeaderDots extends StatelessWidget {
  const _HeaderDots();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
