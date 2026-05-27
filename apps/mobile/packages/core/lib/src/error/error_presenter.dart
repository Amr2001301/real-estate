import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../l10n/l10n.dart';
import 'app_failure.dart';
import 'error_reporter.dart';
import 'failure_localizations.dart';

/// Action-level failure presentation: a friendly, localized SnackBar with an
/// optional retry. Use for failures that happen in response to a user action
/// (submit, toggle, refresh) rather than screen-load failures (use a full
/// `StateView` / `ErrorState` for those).
void showFailureSnackBar(
  BuildContext context,
  AppFailure failure, {
  VoidCallback? onRetry,
}) {
  AppLog.failure(failure);

  final colors = context.appColors;
  final l10n = context.l10n;
  final showRetry = failure.isRetryable && onRetry != null;

  final messenger = ScaffoldMessenger.of(context)..hideCurrentSnackBar();
  messenger.showSnackBar(
    SnackBar(
      content: Text(failure.userMessage(l10n)),
      backgroundColor: colors.inkStrong,
      action: showRetry
          ? SnackBarAction(
              label: l10n.actionRetry,
              textColor: colors.brandGold,
              onPressed: onRetry,
            )
          : null,
    ),
  );
}
