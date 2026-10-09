import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../common/price_formatter.dart';

/// The signed-in user's company currency, read from `GET /company/currency`
/// (open to every company role). Used by apps that do not load the public
/// branding (the staff app). Applies it to [PriceFormatter]; on failure the
/// currency stays as it was (EGP by default).
class CompanyCurrencyCubit extends Cubit<String> {
  CompanyCurrencyCubit(this._dio) : super(PriceFormatter.currencyCode);

  final Dio _dio;

  Future<void> load() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/company/currency');
      final code = res.data?['currency'] as String?;
      if (code == null || isClosed) return;
      PriceFormatter.currencyCode = code;
      emit(PriceFormatter.currencyCode);
    } catch (_) {
      // Keep the current currency; prices still render.
    }
  }

  /// Back to the default on sign-out so the next company starts clean.
  void reset() {
    if (isClosed) return;
    PriceFormatter.currencyCode = null;
    emit(PriceFormatter.currencyCode);
  }
}
