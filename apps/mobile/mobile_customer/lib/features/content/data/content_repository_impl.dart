import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../domain/content.dart';

class ContentRepositoryImpl implements ContentRepository {
  ContentRepositoryImpl(this._dio);
  final Dio _dio;

  Future<Result<List<T>>> _list<T>(String path, T Function(Map<String, dynamic>) read) => guardApiCall(() async {
        final res = await _dio.get<List<dynamic>>(path);
        return (res.data ?? const []).whereType<Map<String, dynamic>>().map(read).toList();
      });

  Future<Result<T>> _one<T>(String path, T Function(Map<String, dynamic>) read) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>(path);
        final data = res.data;
        // An empty answer reads as not found.
        if (data == null || data.isEmpty) {
          throw DioException(
            requestOptions: res.requestOptions,
            response: Response(requestOptions: res.requestOptions, statusCode: 404),
            type: DioExceptionType.badResponse,
          );
        }
        return read(data);
      });

  @override
  Future<Result<List<ContentBanner>>> banners() => _list('/public/banners', ContentBanner.fromJson);

  @override
  Future<Result<List<ContentPage>>> pages() => _list('/public/pages', ContentPage.fromJson);

  @override
  Future<Result<ContentPage>> page(String slug) => _one('/public/pages/${Uri.encodeComponent(slug)}', ContentPage.fromJson);
}
