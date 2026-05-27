import 'package:flutter/widgets.dart';

import '../l10n/generated/app_localizations.dart';
import 'app_failure.dart';
import 'failure_type.dart';

/// Resolves an [AppErrorMessageKey] / [AppFailure] to a friendly, localized
/// message. This is the only place a failure becomes human-readable — the raw
/// [AppFailure.technicalMessage] is never shown.
extension AppErrorMessageKeyL10n on AppErrorMessageKey {
  String resolve(AppLocalizations l) => switch (this) {
        AppErrorMessageKey.noConnection => l.errorNoConnection,
        AppErrorMessageKey.timeout => l.errorTimeout,
        AppErrorMessageKey.sessionExpired => l.errorSessionExpired,
        AppErrorMessageKey.permissionDenied => l.errorPermissionDenied,
        AppErrorMessageKey.notFound => l.errorNotFound,
        AppErrorMessageKey.validation => l.errorValidation,
        AppErrorMessageKey.server => l.errorServer,
        AppErrorMessageKey.maintenance => l.errorMaintenance,
        AppErrorMessageKey.unknown => l.errorUnknown,
      };
}

extension AppFailureL10n on AppFailure {
  /// The localized, user-facing message. For validation failures, prefers the
  /// backend's safe field messages when present; otherwise the generic key.
  String userMessage(AppLocalizations l) {
    if (type == FailureType.validation && validationMessages.isNotEmpty) {
      return validationMessages.join('\n');
    }
    return userMessageKey.resolve(l);
  }

  /// Same, resolved from a [BuildContext].
  String userMessageOf(BuildContext context) =>
      userMessage(AppLocalizations.of(context));
}
