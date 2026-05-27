import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';
import '../error/app_failure.dart';
import '../error/error_reporter.dart';
import '../error/failure_localizations.dart';
import '../l10n/l10n.dart';
import 'app_button.dart';

/// Full-screen error + retry state for screen-level load failures (distinct
/// from [EmptyState], which means "no data", not "something failed").
///
/// Shows the localized [AppFailure.userMessage]; the retry button appears only
/// when [onRetry] is provided **and** the failure is retryable. The technical
/// detail is logged once (never shown).
class ErrorState extends StatefulWidget {
  const ErrorState({
    super.key,
    this.failure,
    this.title,
    this.message,
    this.onRetry,
    this.icon = Icons.error_outline_rounded,
  });

  final AppFailure? failure;
  final String? title;

  /// Explicit override; otherwise resolved from [failure] or a default.
  final String? message;
  final VoidCallback? onRetry;
  final IconData icon;

  @override
  State<ErrorState> createState() => _ErrorStateState();
}

class _ErrorStateState extends State<ErrorState> {
  @override
  void initState() {
    super.initState();
    if (widget.failure != null) AppLog.failure(widget.failure!);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final l10n = context.l10n;

    final message = widget.message ??
        widget.failure?.userMessage(l10n) ??
        l10n.stateErrorMessage;
    final showRetry =
        widget.onRetry != null && (widget.failure?.isRetryable ?? true);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: colors.error.withValues(alpha: 0.12),
                borderRadius: AppRadii.icon,
              ),
              child: Icon(widget.icon, color: colors.error, size: 28),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              widget.title ?? l10n.stateErrorTitle,
              style: theme.textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              message,
              style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted),
              textAlign: TextAlign.center,
            ),
            if (showRetry) ...[
              const SizedBox(height: AppSpacing.lg),
              AppButton(
                label: l10n.actionRetry,
                icon: Icons.refresh_rounded,
                variant: AppButtonVariant.outline,
                size: AppButtonSize.medium,
                onPressed: widget.onRetry,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
