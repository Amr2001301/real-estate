import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Branded splash shown while the persisted session resolves.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Scaffold(
      backgroundColor: colors.brandNavy,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset('assets/brand/devora-logo.png', width: 96, height: 96),
            const SizedBox(height: AppSpacing.md),
            Text(
              context.l10n.staffAppTitle,
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall
                  ?.copyWith(color: Colors.white),
            ),
            const SizedBox(height: AppSpacing.xl),
            SizedBox(
              height: 22,
              width: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: colors.brandGold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
