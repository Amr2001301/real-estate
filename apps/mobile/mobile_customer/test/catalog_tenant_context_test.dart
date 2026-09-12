import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/catalog/data/datasources/catalog_remote_data_source.dart';

// ── Fake Dio ──────────────────────────────────────────────────────────────────

class _FakeDio extends Fake implements Dio {
  String? capturedPath;
  Map<String, String?>? capturedHeaders;

  void _capture(String path, Options? options) {
    capturedPath = path;
    capturedHeaders = options?.headers?.cast<String, String?>();
  }

  Map<String, dynamic> get _pageBody => {
    'data': <dynamic>[],
    'total': 0,
    'page': 1,
    'pageSize': 20,
  };

  @override
  Future<Response<T>> get<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onReceiveProgress,
  }) async {
    _capture(path, options);
    final body = path.contains('/projects/') || path.contains('/units/')
        ? <String, dynamic>{'id': 'x'}
        : _pageBody;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: body as T,
    );
  }
}

CatalogRemoteDataSourceImpl _ds(_FakeDio dio, {String? slug}) =>
    CatalogRemoteDataSourceImpl(
      dio,
      readTenantSlug: slug != null ? () async => slug : null,
    );

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('CatalogRemoteDataSourceImpl — tenant slug header', () {
    test('listProjects sends X-Tenant-Slug when slug is set', () async {
      final dio = _FakeDio();
      await _ds(dio, slug: 'alpha').listProjects({});
      expect(dio.capturedPath, '/public/projects');
      expect(dio.capturedHeaders?['X-Tenant-Slug'], 'alpha');
    });

    test('listProjects omits X-Tenant-Slug when no reader provided (K1 mode)', () async {
      final dio = _FakeDio();
      await _ds(dio).listProjects({});
      expect(dio.capturedHeaders?.containsKey('X-Tenant-Slug'), isNot(true));
    });

    test('getProject sends X-Tenant-Slug when slug is set', () async {
      final dio = _FakeDio();
      await _ds(dio, slug: 'alpha').getProject('p1');
      expect(dio.capturedPath, '/public/projects/p1');
      expect(dio.capturedHeaders?['X-Tenant-Slug'], 'alpha');
    });

    test('listUnits sends X-Tenant-Slug when slug is set', () async {
      final dio = _FakeDio();
      await _ds(dio, slug: 'beta').listUnits({});
      expect(dio.capturedHeaders?['X-Tenant-Slug'], 'beta');
    });

    test('getUnit sends X-Tenant-Slug when slug is set', () async {
      final dio = _FakeDio();
      await _ds(dio, slug: 'beta').getUnit('u1');
      expect(dio.capturedPath, '/public/units/u1');
      expect(dio.capturedHeaders?['X-Tenant-Slug'], 'beta');
    });

    test('slug changes between calls (reader called per-request)', () async {
      final dio = _FakeDio();
      String current = 'alpha';
      final ds = CatalogRemoteDataSourceImpl(dio, readTenantSlug: () async => current);

      await ds.listProjects({});
      expect(dio.capturedHeaders?['X-Tenant-Slug'], 'alpha');

      current = 'beta';
      await ds.listProjects({});
      expect(dio.capturedHeaders?['X-Tenant-Slug'], 'beta');
    });

    test('skipAuthExtra is always set (no bearer on public calls)', () async {
      String? capturedExtra;
      final dio2 = _ExtraCapturingDio(onCapture: (extra) { capturedExtra = extra; });
      final ds = CatalogRemoteDataSourceImpl(dio2, readTenantSlug: () async => 'alpha');
      await ds.listProjects({});
      expect(capturedExtra, 'true', reason: 'skipAuthExtra must be set on all public catalog requests');
    });
  });
}

class _ExtraCapturingDio extends Fake implements Dio {
  _ExtraCapturingDio({required void Function(String?) onCapture}) : _onCapture = onCapture;
  final void Function(String?) _onCapture;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onReceiveProgress,
  }) async {
    final val = options?.extra?[AuthInterceptor.skipAuthExtra];
    _onCapture(val?.toString());
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'data': <dynamic>[], 'total': 0, 'page': 1, 'pageSize': 20} as T,
    );
  }
}
