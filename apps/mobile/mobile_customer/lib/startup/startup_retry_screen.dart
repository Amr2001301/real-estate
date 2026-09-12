import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bootstrap.dart' show customerStartupOutcome;
import 'customer_startup_service.dart';

/// Shown when the app cold-starts with a persisted company slug but the startup
/// tenant resolve fails due to a network/timeout error.
///
/// The router redirects here (via the [TenantStartupOutcome.networkError] guard)
/// and stays until:
///   - Retry succeeds ([TenantStartupOutcome.valid])   → session restored → /home
///   - Retry finds company unavailable                 → tokens cleared  → /select-company
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
        // checkEligibility already cleared the slug. Clear stale auth tokens.
        await tokenStorage.clear();
        // Router re-evaluates: !authed + !hasCompany → /select-company.

      case TenantStartupOutcome.networkError:
        // Still offline — stay on this screen; router keeps showing /startup-retry.
        setState(() => _retrying = false);
        return;

      case TenantStartupOutcome.noSlug:
        // Shouldn't reach here (retry screen only shown when a slug was saved).
        // Clear stale tokens defensively; router: !hasCompany → /select-company.
        await tokenStorage.clear();
    }

    if (mounted) setState(() => _retrying = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.wifi_off_rounded,
                  size: 64,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                const SizedBox(height: 24),
                Text(
                  'Could not connect',
                  style: Theme.of(context).textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  'Please check your connection and try again.',
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                if (_retrying)
                  const CircularProgressIndicator()
                else
                  FilledButton(
                    onPressed: _retry,
                    child: const Text('Retry'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
