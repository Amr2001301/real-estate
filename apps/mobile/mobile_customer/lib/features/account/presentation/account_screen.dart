import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../auth/presentation/auth_cubit.dart';
import '../../notifications/presentation/unread_count_cubit.dart';
import '../../notifications/presentation/widgets/customer_notification_button.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Account Screen
// ─────────────────────────────────────────────────────────────────────────────

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  @override
  void initState() {
    super.initState();
    context.read<UnreadCountCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.watch<SessionCubit>().state.sessionOrNull;
    final unread = context.watch<UnreadCountCubit>().state;
    final name = session?.displayName ?? session?.email ?? l10n.accountRoleCustomer;

    return Column(
      children: [
        _AccountHeader(name: name, l10n: l10n),
        Expanded(
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.xl + MediaQuery.of(context).padding.bottom,
            ),
            children: [
              // ── Quick access: 4 personal items ───────────────────────────
              _QuickAccessBar(l10n: l10n, unread: unread),
              const SizedBox(height: AppSpacing.xl),

              // ── خدمات العميل (premium list style) ────────────────────────
              _SectionLabel(title: l10n.accountSectionServices),
              const SizedBox(height: AppSpacing.sm),
              _ServicesListCard(l10n: l10n),
              const SizedBox(height: AppSpacing.xl),

              // ── الإعدادات ────────────────────────────────────────────────
              _SectionLabel(title: l10n.accountSectionSettings),
              const SizedBox(height: AppSpacing.sm),
              _SettingsRow(l10n: l10n),
              const SizedBox(height: AppSpacing.xl),

              // ── Logout ───────────────────────────────────────────────────
              _LogoutButton(
                label: l10n.actionLogout,
                onTap: () => _confirmLogout(context),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final l10n = context.l10n;
    final authCubit = context.read<AuthCubit>();
    final confirmed = await showAdaptiveConfirm(
      context,
      title: l10n.actionLogout,
      message: l10n.logoutConfirmMessage,
      confirmLabel: l10n.actionLogout,
      cancelLabel: l10n.actionCancel,
      destructive: true,
    );
    if (confirmed) authCubit.logout();
  }
}

// ── Screen header ─────────────────────────────────────────────────────────────

class _AccountHeader extends StatelessWidget {
  const _AccountHeader({required this.name, required this.l10n});
  final String name;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
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
            // Gold radial glow at end corner
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
            // Gold shimmer at bottom
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
                  // START (right in RTL): avatar → profile
                  GestureDetector(
                    onTap: () => context.push('/account/profile'),
                    child: _GoldRingAvatar(name: name),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.navAccount,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: AppPalette.gold300,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          name,
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
                            l10n.accountRoleCustomer,
                            style: const TextStyle(
                              color: _navyDeep,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  const CustomerNotificationButton(size: 44),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Quick access bar ──────────────────────────────────────────────────────────

class _QuickAccessBar extends StatelessWidget {
  const _QuickAccessBar({required this.l10n, required this.unread});
  final AppLocalizations l10n;
  final int unread;

  @override
  Widget build(BuildContext context) {
    final items = [
      _QItem(
        icon: AppIcons.profile,
        label: l10n.accountProfile,
        navyStyle: true,
        onTap: () => context.push('/account/profile'),
      ),
      _QItem(
        icon: AppIcons.favorite,
        label: l10n.accountFavorites,
        navyStyle: false,
        onTap: () => context.push('/account/favorites'),
      ),
      _QItem(
        icon: AppIcons.visit,
        label: l10n.accountMyRequests,
        navyStyle: true,
        onTap: () => context.push('/account/requests'),
      ),
      _QItem(
        icon: AppIcons.notification,
        label: l10n.accountNotifications,
        navyStyle: false,
        badge: unread,
        onTap: () => context.push('/account/notifications'),
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
    this.badge = 0,
  });
  final IconData icon;
  final String label;
  final bool navyStyle;
  final VoidCallback onTap;
  final int badge;
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
                      fontSize: 10.5,
                    ),
                  ),
                ],
              ),
              // Notification badge
              if (item.badge > 0)
                PositionedDirectional(
                  top: 0,
                  end: AppSpacing.xs,
                  child: Container(
                    width: 17,
                    height: 17,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppPalette.gold300, AppPalette.gold500],
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppPalette.gold400.withValues(alpha: 0.4),
                          blurRadius: 6,
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        '${item.badge}',
                        style: const TextStyle(
                          color: _navyDeep,
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
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

// ── Section label ─────────────────────────────────────────────────────────────

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

// ── Services list card ────────────────────────────────────────────────────────

class _ServicesListCard extends StatelessWidget {
  const _ServicesListCard({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    final services = [
      _SItem(
        icon: AppIcons.property,
        label: l10n.accountMyProperty,
        subtitle: 'وحداتك العقارية ومتابعة حالتها',
        navyStyle: true,
        onTap: () => context.push('/account/property'),
      ),
      _SItem(
        icon: AppIcons.contract,
        label: l10n.accountContracts,
        subtitle: l10n.financeContractsDesc,
        navyStyle: false,
        onTap: () => context.push('/account/contracts'),
      ),
      _SItem(
        icon: AppIcons.installments,
        label: l10n.installmentsTitle,
        subtitle: l10n.financeInstallmentsDesc,
        navyStyle: true,
        onTap: () => context.push('/account/installments'),
      ),
      _SItem(
        icon: AppIcons.deposit,
        label: l10n.accountDeposits,
        subtitle: l10n.financeDepositsDesc,
        navyStyle: false,
        onTap: () => context.push('/account/deposits'),
      ),
      _SItem(
        icon: AppIcons.maintenance,
        label: l10n.accountMaintenance,
        subtitle: 'طلبات الصيانة والإصلاح',
        navyStyle: true,
        onTap: () => context.push('/account/maintenance'),
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
            // Icon tile
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
            // Title + subtitle
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

// ── Settings row (2 equal tiles) ──────────────────────────────────────────────

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({required this.l10n});
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

// ── Logout button ─────────────────────────────────────────────────────────────

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

// ── Gold ring avatar ──────────────────────────────────────────────────────────

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

// ── Dot texture ───────────────────────────────────────────────────────────────

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
