import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Prices follow the company currency (Company.currency), set by the admin on
/// the dashboard branding page — not a hard-coded ج.م / EGP.
class _FakeBrandingRepository extends BrandingRepository {
  _FakeBrandingRepository(this._tokens) : super(Dio());

  final BrandTokens? _tokens;

  @override
  Future<BrandTokens?> fetchBranding(String slug) async => _tokens;
}

/// A Dio whose every request answers [data] (or fails when [fail]).
Dio _dioAnswering(Map<String, dynamic>? data, {bool fail = false}) {
  final dio = Dio();
  dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
    if (fail) {
      handler.reject(DioException(requestOptions: options));
    } else {
      handler.resolve(Response(requestOptions: options, data: data));
    }
  }));
  return dio;
}

void main() {
  tearDown(() => PriceFormatter.currencyCode = null);

  group('PriceFormatter currency', () {
    test('defaults to EGP', () {
      expect(PriceFormatter.currencyCode, 'EGP');
      expect(PriceFormatter.format(1000, languageCode: 'ar'), contains('ج.م'));
      expect(PriceFormatter.format(1000, languageCode: 'en'), endsWith('EGP'));
    });

    test('uses the company currency once set', () {
      PriceFormatter.currencyCode = 'SAR';
      expect(PriceFormatter.format(5800000, languageCode: 'ar'), contains('ر.س'));
      expect(PriceFormatter.format(5800000, languageCode: 'ar'),
          isNot(contains('ج.م')));
      expect(PriceFormatter.format(5800000, languageCode: 'en'),
          '5,800,000 SAR');
      expect(PriceFormatter.formatCompact(1600000, languageCode: 'en'),
          '1.6M SAR');
      expect(PriceFormatter.symbol('ar'), 'ر.س');
    });

    test('normalizes case and falls back to EGP for unknown codes', () {
      PriceFormatter.currencyCode = ' aed ';
      expect(PriceFormatter.currencyCode, 'AED');
      PriceFormatter.currencyCode = 'XYZ';
      expect(PriceFormatter.currencyCode, 'EGP');
      PriceFormatter.currencyCode = '';
      expect(PriceFormatter.currencyCode, 'EGP');
    });

    test('an explicit currency overrides the company one', () {
      PriceFormatter.currencyCode = 'SAR';
      expect(
          PriceFormatter.format(10, languageCode: 'en', currency: 'KWD'),
          '10 KWD');
      expect(PriceFormatter.symbol('ar', 'EGP'), 'ج.م');
    });
  });

  group('branding carries the currency', () {
    test('BrandTokens.fromJson reads currency', () {
      final t = BrandTokens.fromJson({'displayName': 'X', 'currency': 'QAR'});
      expect(t.currency, 'QAR');
      expect(BrandTokens.fromJson(const {}).currency, isNull);
    });

    test('BrandingCubit.load applies it; clear resets to EGP', () async {
      final cubit = BrandingCubit(
          _FakeBrandingRepository(const BrandTokens(currency: 'SAR')));
      await cubit.load('acme');
      expect(PriceFormatter.currencyCode, 'SAR');
      cubit.clear();
      expect(PriceFormatter.currencyCode, 'EGP');
      await cubit.close();
    });

    test('BrandingCubit.load falls back to EGP when branding fails', () async {
      PriceFormatter.currencyCode = 'SAR';
      final cubit = BrandingCubit(_FakeBrandingRepository(null));
      await cubit.load('acme');
      expect(PriceFormatter.currencyCode, 'EGP');
      await cubit.close();
    });
  });

  group('CompanyCurrencyCubit (staff app)', () {
    test('load reads GET /company/currency', () async {
      final cubit = CompanyCurrencyCubit(_dioAnswering({'currency': 'AED'}));
      await cubit.load();
      expect(cubit.state, 'AED');
      expect(PriceFormatter.currencyCode, 'AED');
      cubit.reset();
      expect(cubit.state, 'EGP');
      expect(PriceFormatter.currencyCode, 'EGP');
      await cubit.close();
    });

    test('a failed request keeps the current currency', () async {
      PriceFormatter.currencyCode = 'SAR';
      final cubit = CompanyCurrencyCubit(_dioAnswering(null, fail: true));
      await cubit.load();
      expect(PriceFormatter.currencyCode, 'SAR');
      await cubit.close();
    });
  });
}
