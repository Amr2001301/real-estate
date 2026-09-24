import 'package:flutter_bloc/flutter_bloc.dart';

import 'brand_tokens.dart';
import 'branding_repository.dart';

/// Holds the active tenant's [BrandTokens]. Starts as null (default palette).
///
/// Call [load] after a company slug is known (post-selection or on restart).
/// On failure the state stays null and the app renders with the default theme.
class BrandingCubit extends Cubit<BrandTokens?> {
  BrandingCubit(this._repository) : super(null);

  final BrandingRepository _repository;

  Future<void> load(String slug) async {
    final tokens = await _repository.fetchBranding(slug);
    if (!isClosed) emit(tokens);
  }

  void clear() {
    if (!isClosed) emit(null);
  }
}
