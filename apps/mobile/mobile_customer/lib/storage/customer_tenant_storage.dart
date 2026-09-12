import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists the customer's selected Company (tenant selection) across sessions.
///
/// Uses SharedPreferences (plain, non-secret) because the slug and display name
/// are not credentials — they are public discovery data (the user selected from
/// a public search result).
///
/// Key namespace: `customer.*` — entirely distinct from the staff app's
/// `auth.selectedCompanySlug` (which lives in FlutterSecureStorage under a
/// different key). The apps also run as separate binaries with isolated storage,
/// so there is no key-collision risk even in the unlikely event of shared prefs
/// on a test device.
///
/// Extends [ChangeNotifier] so the router can include it in `refreshListenable`
/// and re-evaluate the company-guard redirect whenever the selection changes
/// (e.g., after mismatch-clear or new selection).
class CustomerTenantStorage extends ChangeNotifier {
  CustomerTenantStorage(this._prefs);

  final SharedPreferences _prefs;

  // Public constants so bootstrap.dart can build a slug reader without
  // hard-coding the key string.
  static const String kSlugKey = 'customer.selectedCompanySlug';
  static const String kNameKey = 'customer.selectedCompanyName';

  String? get selectedCompanySlug => _prefs.getString(kSlugKey);
  String? get selectedCompanyName => _prefs.getString(kNameKey);

  Future<void> saveSelectedCompany({
    required String slug,
    required String name,
  }) async {
    await _prefs.setString(kSlugKey, slug);
    await _prefs.setString(kNameKey, name);
    notifyListeners();
  }

  Future<void> clearSelectedCompany() async {
    await _prefs.remove(kSlugKey);
    await _prefs.remove(kNameKey);
    notifyListeners();
  }

  bool get hasSelectedCompany =>
      selectedCompanySlug != null && selectedCompanySlug!.isNotEmpty;
}
