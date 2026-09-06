import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/role_label.dart';
import '../../../../auth/presentation/cubit/staff_auth_cubit.dart';
import '../cubit/broker_profile_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Broker Profile Screen
// ─────────────────────────────────────────────────────────────────────────────

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  final a = parts.first.characters.firstOrNull ?? '?';
  if (parts.length >= 2) {
    final b = parts.last.characters.firstOrNull ?? '';
    return '$a$b'.toUpperCase();
  }
  return a.toUpperCase();
}

class BrokerProfileScreen extends StatelessWidget {
  const BrokerProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: Column(
          children: [
            // ── Identity header ───────────────────────────────────────────
            BlocBuilder<BrokerProfileCubit, BrokerProfileState>(
              builder: (context, state) {
                final session =
                    context.read<SessionCubit>().state.sessionOrNull;
                final p = state.data;
                final name = p?.fullName ?? session?.displayName ?? '—';
                final company = p?.companyName;
                final isLoading = state.status == DataStatus.loading ||
                    state.status == DataStatus.initial;

                return _ProfileHeader(
                  name: name,
                  company: company,
                  isLoading: isLoading,
                  l10n: l10n,
                );
              },
            ),

            // ── Settings body ─────────────────────────────────────────────
            Expanded(
              child: ListView(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.xl + MediaQuery.of(context).padding.bottom,
                ),
                children: [
                  // ── Settings group card ───────────────────────────────────
                  _GroupCard(
                    children: [
                      // Commission tile (conditional)
                      BlocBuilder<BrokerProfileCubit, BrokerProfileState>(
                        buildWhen: (a, b) =>
                            a.data?.canViewCommissions !=
                            b.data?.canViewCommissions,
                        builder: (context, state) {
                          if (state.data?.canViewCommissions != true) {
                            return const SizedBox.shrink();
                          }
                          return Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _SettingRow(
                                icon: Icons.payments_rounded,
                                iconColor: AppPalette.gold400,
                                iconBg: AppPalette.gold400
                                    .withValues(alpha: 0.12),
                                label: l10n.navCommissions,
                                onTap: () =>
                                    context.push('/broker/commissions'),
                              ),
                              _Divider(),
                            ],
                          );
                        },
                      ),

                      // Language
                      _SettingRow(
                        icon: Icons.translate_rounded,
                        iconColor: const Color(0xFF60A5FA),
                        iconBg: const Color(0xFF60A5FA).withValues(alpha: 0.12),
                        label: l10n.settingsLanguage,
                        trailing: Text(
                          l10n.languageName,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colors.inkMuted,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        onTap: () => context.read<LocaleCubit>().toggle(),
                      ),
                      _Divider(),

                      // Theme
                      _SettingRow(
                        icon: Icons.brightness_6_rounded,
                        iconColor: const Color(0xFFA78BFA),
                        iconBg: const Color(0xFFA78BFA).withValues(alpha: 0.12),
                        label: l10n.settingsTheme,
                        onTap: () => context.read<ThemeCubit>().cycle(),
                      ),
                    ],
                  ),

                  const SizedBox(height: AppSpacing.xl),

                  // ── Logout ────────────────────────────────────────────────
                  _LogoutButton(l10n: l10n),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Profile header ────────────────────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.name,
    required this.company,
    required this.isLoading,
    required this.l10n,
  });

  final String name;
  final String? company;
  final bool isLoading;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_navyLight, _navyMid, _navyDeep],
          stops: [0.0, 0.45, 1.0],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x35000000),
            blurRadius: 22,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Dot texture
          const Positioned.fill(
            child: IgnorePointer(child: _DotTexture()),
          ),
          // Gold radial bloom
          PositionedDirectional(
            end: 0,
            top: 0,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.12),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          // Gold hairline
          Positioned(
            bottom: 0,
            left: 48,
            right: 48,
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
          // Content
          Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              topInset + AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.xl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Nav label
                Text(
                  l10n.navProfile,
                  style: const TextStyle(
                    color: AppPalette.gold300,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // Identity row
                Row(
                  children: [
                    // Avatar
                    if (isLoading)
                      Container(
                        width: 68,
                        height: 68,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.10),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.15),
                            width: 2,
                          ),
                        ),
                      )
                    else
                      Container(
                        width: 68,
                        height: 68,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppPalette.gold400, AppPalette.gold300],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppPalette.gold300.withValues(alpha: 0.40),
                            width: 2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AppPalette.gold400.withValues(alpha: 0.35),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          _initials(name),
                          style: const TextStyle(
                            color: _navyDeep,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            height: 1,
                          ),
                        ),
                      ),
                    const SizedBox(width: AppSpacing.md),
                    // Name + company + role badge
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isLoading ? '' : name,
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              height: 1.1,
                              letterSpacing: -0.3,
                            ),
                          ),
                          if (company != null && !isLoading) ...[
                            const SizedBox(height: 3),
                            Text(
                              company!,
                              style: const TextStyle(
                                color: AppPalette.gold300,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                          const SizedBox(height: AppSpacing.sm),
                          // Role badge
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.12),
                              borderRadius: AppRadii.pillAll,
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.20),
                                width: 0.8,
                              ),
                            ),
                            child: Text(
                              roleLabel(l10n, AppRole.broker),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
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
            ),
          ),
        ],
      ),
    );
  }
}

// ── Group card ────────────────────────────────────────────────────────────────

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.card,
        border: Border.all(color: colors.hairline, width: 0.8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: children),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      height: 0.5,
      margin: const EdgeInsetsDirectional.only(start: 60),
      color: colors.hairline,
    );
  }
}

// ── Setting row ───────────────────────────────────────────────────────────────

class _SettingRow extends StatefulWidget {
  const _SettingRow({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.label,
    required this.onTap,
    this.trailing,
  });

  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String label;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  State<_SettingRow> createState() => _SettingRowState();
}

class _SettingRowState extends State<_SettingRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        color: _pressed
            ? colors.hairline.withValues(alpha: 0.5)
            : Colors.transparent,
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: 14),
        child: Row(
          children: [
            // Icon badge
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: widget.iconBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(widget.icon, color: widget.iconColor, size: 19),
            ),
            const SizedBox(width: AppSpacing.sm),
            // Label
            Expanded(
              child: Text(
                widget.label,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            // Optional trailing widget (e.g. current value text)
            if (widget.trailing != null) ...[
              widget.trailing!,
              const SizedBox(width: AppSpacing.xs),
            ],
            // RTL-aware chevron
            Icon(
              Icons.arrow_forward_ios_rounded,
              size: 13,
              color: colors.inkMuted,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Logout button ─────────────────────────────────────────────────────────────

class _LogoutButton extends StatefulWidget {
  const _LogoutButton({required this.l10n});
  final AppLocalizations l10n;

  @override
  State<_LogoutButton> createState() => _LogoutButtonState();
}

class _LogoutButtonState extends State<_LogoutButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => context.read<StaffAuthCubit>().logout(),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        height: 52,
        decoration: BoxDecoration(
          color: _pressed
              ? colors.error.withValues(alpha: 0.08)
              : colors.error.withValues(alpha: 0.05),
          borderRadius: AppRadii.pillAll,
          border: Border.all(
            color: colors.error.withValues(alpha: _pressed ? 0.35 : 0.20),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.logout_rounded, size: 18, color: colors.error),
            const SizedBox(width: AppSpacing.xs),
            Text(
              widget.l10n.actionLogout,
              style: TextStyle(
                color: colors.error,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Shared ────────────────────────────────────────────────────────────────────

class _DotTexture extends StatelessWidget {
  const _DotTexture();

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
