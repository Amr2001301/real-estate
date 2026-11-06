import 'dart:convert';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../common/price_formatter.dart';
import 'brand_tokens.dart';
import 'branding_repository.dart';

/// Holds the active tenant's [BrandTokens]. Starts as null (default palette).
///
/// Call [load] after a company slug is known (post-selection or on restart).
/// On failure the state stays null and the app renders with the default theme.
///
/// Also applies the company currency to [PriceFormatter] (EGP when unknown),
/// so every price in the app follows the tenant.
///
/// With [prefs] the last branding that arrived is kept on the device per
/// company: the app opens in the company's colours at once (and offline),
/// then refreshes from the server — a change made in the dashboard shows from
/// the next launch, with no new release and no flash of the default palette.
class BrandingCubit extends Cubit<BrandTokens?> {
  BrandingCubit(
    this._repository, {
    this.fallbackName,
    SharedPreferences? prefs,
    String? initialSlug,
  })  : _prefs = prefs,
        _slug = initialSlug,
        super(_readCached(prefs, initialSlug)) {
    PriceFormatter.currencyCode = state?.currency;
  }

  final BrandingRepository _repository;
  final SharedPreferences? _prefs;

  /// The company whose tokens [state] holds (or is about to hold).
  String? _slug;

  static String _key(String slug) => 'brand.tokens.$slug';

  static BrandTokens? _readCached(SharedPreferences? prefs, String? slug) {
    if (prefs == null || slug == null || slug.isEmpty) return null;
    final raw = prefs.getString(_key(slug));
    if (raw == null) return null;
    try {
      return BrandTokens.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  /// The company's name before (or without) its branding — a company's own
  /// app knows it from its build; the shared app does not.
  final String? fallbackName;

  /// Shows [slug]'s branding: its saved copy at once (never another company's
  /// tokens while a request is in flight), then what the server says.
  Future<void> load(String slug) async {
    if (_slug != slug) {
      _slug = slug;
      final cached = _readCached(_prefs, slug);
      PriceFormatter.currencyCode = cached?.currency;
      emit(cached);
    }
    final tokens = await _repository.fetchBranding(slug);
    if (isClosed || _slug != slug) return;
    if (tokens == null) return; // offline or failing: keep what is shown
    PriceFormatter.currencyCode = tokens.currency;
    await _prefs?.setString(_key(slug), jsonEncode(tokens.toJson()));
    if (!isClosed && _slug == slug) emit(tokens);
  }

  void clear() {
    if (isClosed) return;
    _slug = null;
    PriceFormatter.currencyCode = null;
    emit(null);
  }
}
