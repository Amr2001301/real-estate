import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../l10n/l10n.dart';
import '../design/tokens/app_spacing.dart';
import '../design/theme/app_theme_ext.dart';
import '../network/connectivity_cubit.dart';

/// Thin warning bar shown at the top of the app when the device loses
/// connectivity. Animates in/out with [AnimatedSwitcher]. Must be placed
/// below a [BlocProvider<ConnectivityCubit>] ancestor.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ConnectivityCubit, ConnectivityState>(
      builder: (context, state) => AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        transitionBuilder: (child, animation) => SizeTransition(
          sizeFactor: animation,
          alignment: Alignment.topCenter,
          child: child,
        ),
        child: state.isConnected
            ? const SizedBox.shrink(key: ValueKey(true))
            : _Banner(key: const ValueKey(false)),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return SafeArea(
      bottom: false,
      child: Material(
        color: colors.warning,
        child: SizedBox(
          width: double.infinity,
          child: Padding(
            padding: const EdgeInsets.symmetric(
                vertical: 6, horizontal: AppSpacing.md),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.wifi_off_rounded,
                    size: 14, color: Colors.white),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  l10n.offlineMessage,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
