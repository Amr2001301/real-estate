import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Placeholder staff login. Phase 1 demonstrates the auth guard: signing in as
/// a demo Sales/Broker user unlocks the dashboard. Real email/password login
/// (`/auth/login`) lands in a later phase.
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.actionLogin)),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(Icons.badge_outlined, size: 48, color: colors.brandGold),
            const SizedBox(height: AppSpacing.md),
            Text(
              l10n.staffAppTitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: AppSpacing.xxl),
            AppButton(
              label: '${l10n.actionLogin} — Sales (demo)',
              icon: Icons.login_rounded,
              expand: true,
              onPressed: () => _signIn(context, AppRole.sales),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: '${l10n.actionLogin} — Broker (demo)',
              icon: Icons.handshake_outlined,
              variant: AppButtonVariant.outline,
              expand: true,
              onPressed: () => _signIn(context, AppRole.broker),
            ),
          ],
        ),
      ),
    );
  }

  void _signIn(BuildContext context, AppRole role) {
    context.read<SessionCubit>().signIn(
          session: Session(
            userId: 'demo-${role.wire.toLowerCase()}',
            role: role,
            displayName: 'Demo ${role.wire}',
          ),
          accessToken: 'demo-access-token',
          refreshToken: 'demo-refresh-token',
        );
  }
}
