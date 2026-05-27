import 'package:core/core.dart';

/// Client-side, localized form validators for the auth screens. Backend
/// validation still flows through `AppFailure` (shown via SnackBar).
class AuthValidators {
  const AuthValidators(this.l10n);
  final AppLocalizations l10n;

  String? required(String? v) =>
      (v == null || v.trim().isEmpty) ? l10n.validationRequired : null;

  String? email(String? v) {
    if (v == null || v.trim().isEmpty) return l10n.validationRequired;
    final ok = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim());
    return ok ? null : l10n.validationEmail;
  }

  String? phone(String? v) {
    if (v == null || v.trim().isEmpty) return l10n.validationRequired;
    final ok = RegExp(r'^\+?[1-9]\d{7,14}$').hasMatch(v.trim());
    return ok ? null : l10n.validationPhone;
  }

  String? password(String? v) {
    if (v == null || v.isEmpty) return l10n.validationRequired;
    return v.length < 8 ? l10n.validationPasswordShort : null;
  }

  String? code(String? v) =>
      (v == null || v.trim().length < 4) ? l10n.validationCodeShort : null;
}
