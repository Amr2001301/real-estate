import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bootstrap.dart' show customerStartupOutcome;
import 'customer_startup_service.dart';

/// Shown when the app's company cannot be used at start: the resolve failed
/// on the network ("no connection") or the company is not available (switched
/// off: "the app is not available right now"). Every customer app is one
/// company's, so there is nothing else to open.
///
/// The router redirects here while the outcome is networkError or unavailable
/// and stays until:
///   - Retry succeeds ([TenantStartupOutcome.valid])   → session restored → /home
///   - Retry finds the company unavailable              → tokens cleared, stays here
///   - Retry fails again ([TenantStartupOutcome.networkError]) → stays here
///
/// Security invariant: no authenticated API request is issued while this
/// screen is visible. [SessionCubit] is unauthenticated (tokens preserved
/// by the null return from [SessionCubit.restore] additionalCheck).
class StartupRetryScreen extends StatefulWidget {
  const StartupRetryScreen({super.key});

  @override
  State<StartupRetryScreen> createState() => _StartupRetryScreenState();
}

class _StartupRetryScreenState extends State<StartupRetryScreen> {
  bool _retrying = false;

  Future<void> _retry() async {
    setState(() => _retrying = true);

    final service = context.read<CustomerStartupService>();
    final sessionCubit = context.read<SessionCubit>();
    final tokenStorage = context.read<TokenStorage>();

    final outcome = await service.checkEligibility();

    // Update the notifier first — router refreshListenable fires on the next
    // microtask, after we've updated sessionCubit / tokenStorage below.
    customerStartupOutcome.value = outcome;

    if (!mounted) return;

    switch (outcome) {
      case TenantStartupOutcome.valid:
        // Tokens were preserved (null return from additionalCheck at startup).
        // Restore session now that eligibility is confirmed — no additionalCheck
        // needed since we just validated.
        await sessionCubit.restore();
        // Router re-evaluates: outcome=valid + session authenticated → /home.

      case TenantStartupOutcome.unavailable:
        // Clear stale auth tokens; the screen now says the app is unavailable.
        await tokenStorage.clear();

      case TenantStartupOutcome.networkError:
        // Still offline — stay on this screen; router keeps showing /startup-retry.
        setState(() => _retrying = false);
        return;

      case TenantStartupOutcome.noSlug:
        // A build always has its company; clear stale tokens defensively.
        await tokenStorage.clear();
    }

    if (mounted) setState(() => _retrying = false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final unavailable = customerStartupOutcome.value != TenantStartupOutcome.networkError;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  unavailable ? Icons.storefront_outlined : Icons.wifi_off_rounded,
                  size: 64,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                const SizedBox(height: 24),
                Text(
                  unavailable ? l10n.companyUnavailableTitle : l10n.stateNoConnection,
                  style: Theme.of(context).textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  unavailable ? l10n.companyUnavailableMessage : l10n.errorNoConnection,
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                if (_retrying)
                  const CircularProgressIndicator()
                else
                  FilledButton(
                    onPressed: _retry,
                    child: Text(l10n.actionRetry),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
