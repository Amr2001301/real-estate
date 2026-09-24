import 'package:dio/dio.dart';

import 'brand_tokens.dart';

/// Fetches tenant branding from GET /public/branding?slug=<slug>.
///
/// Returns null on any failure (network, timeout, unknown slug).
/// The caller never needs to handle exceptions from this class.
class BrandingRepository {
  const BrandingRepository(this._dio);

  final Dio _dio;

  /// 5 s hard timeout — a cold-start stall on mobile is worse than on web.
  /// On failure the app continues with the default navy/gold palette.
  Future<BrandTokens?> fetchBranding(String slug) async {
    if (slug.isEmpty) return null;
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/public/branding',
        queryParameters: {'slug': slug},
        options: Options(
          receiveTimeout: const Duration(seconds: 5),
          sendTimeout: const Duration(seconds: 5),
        ),
      );
      final data = response.data;
      if (data == null) return null;
      return BrandTokens.fromJson(data);
    } catch (_) {
      return null;
    }
  }
}
