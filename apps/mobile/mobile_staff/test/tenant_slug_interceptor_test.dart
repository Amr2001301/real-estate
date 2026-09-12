import 'package:core/core.dart';
import 'package:core/src/network/interceptors/tenant_slug_interceptor.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

// Minimal handler that records the calls made to it.
class _FakeHandler extends Interceptor {
  final List<RequestOptions> requests = [];
  final List<DioException> errors = [];

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    requests.add(options);
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    errors.add(err);
    handler.next(err);
  }
}

/// Build a [Dio] wired with [TenantSlugInterceptor] and a recording handler.
/// [mockAdapter] provides the fake response.
({Dio dio, _FakeHandler recorder}) _makeDio({
  required TenantSlugReader readSlug,
  TenantMismatchHandler? onMismatch,
  required MockAdapter adapter,
}) {
  final recorder = _FakeHandler();
  final dio = Dio(BaseOptions(baseUrl: 'http://test'));
  dio.interceptors.add(TenantSlugInterceptor(
    readSlug: readSlug,
    onMismatch: onMismatch,
  ));
  dio.interceptors.add(recorder);
  dio.httpClientAdapter = adapter;
  return (dio: dio, recorder: recorder);
}

/// Minimal adapter that always returns [statusCode] with [body].
class MockAdapter implements HttpClientAdapter {
  MockAdapter({required this.statusCode, this.body = ''});
  final int statusCode;
  final String body;

  @override
  Future<ResponseBody> fetch(
      RequestOptions options, _, _) async {
    return ResponseBody.fromString(body, statusCode);
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  group('TenantSlugInterceptor — header inclusion', () {
    test('adds X-Tenant-Slug on authenticated requests when slug is present',
        () async {
      const slug = 'acme-corp';
      final (:dio, :recorder) = _makeDio(
        readSlug: () async => slug,
        adapter: MockAdapter(statusCode: 200),
      );
      try {
        await dio.get('/dashboard');
      } catch (_) {}
      expect(recorder.requests.last.headers['X-Tenant-Slug'], slug);
    });

    test('does NOT add header when no slug is stored (null)', () async {
      final (:dio, :recorder) = _makeDio(
        readSlug: () async => null,
        adapter: MockAdapter(statusCode: 200),
      );
      try {
        await dio.get('/dashboard');
      } catch (_) {}
      expect(recorder.requests.last.headers.containsKey('X-Tenant-Slug'), isFalse);
    });

    test('does NOT add header when slug is empty string', () async {
      final (:dio, :recorder) = _makeDio(
        readSlug: () async => '',
        adapter: MockAdapter(statusCode: 200),
      );
      try {
        await dio.get('/dashboard');
      } catch (_) {}
      expect(recorder.requests.last.headers.containsKey('X-Tenant-Slug'), isFalse);
    });

    test('skips header on requests marked skipAuth (public endpoints)', () async {
      const slug = 'acme-corp';
      final (:dio, :recorder) = _makeDio(
        readSlug: () async => slug,
        adapter: MockAdapter(statusCode: 200),
      );
      try {
        await dio.post(
          '/auth/login-staff',
          data: {'slug': slug, 'email': 'a@b.com', 'password': 'pw'},
          options: Options(extra: {AuthInterceptor.skipAuthExtra: true}),
        );
      } catch (_) {}
      expect(
          recorder.requests.last.headers.containsKey('X-Tenant-Slug'), isFalse,
          reason: 'login endpoint carries slug in body; no header needed');
    });

    test('skips header on refresh (skipAuth public endpoint)', () async {
      final (:dio, :recorder) = _makeDio(
        readSlug: () async => 'acme',
        adapter: MockAdapter(statusCode: 200),
      );
      try {
        await dio.post(
          '/auth/refresh',
          data: {'refreshToken': 'tok'},
          options: Options(extra: {AuthInterceptor.skipAuthExtra: true}),
        );
      } catch (_) {}
      expect(recorder.requests.last.headers.containsKey('X-Tenant-Slug'), isFalse,
          reason: 'refresh is opaque-token based, no tenant header required');
    });

    test('skips header on logout (skipAuth public endpoint)', () async {
      final (:dio, :recorder) = _makeDio(
        readSlug: () async => 'acme',
        adapter: MockAdapter(statusCode: 200),
      );
      try {
        await dio.post(
          '/auth/logout',
          data: {'refreshToken': 'tok'},
          options: Options(extra: {AuthInterceptor.skipAuthExtra: true}),
        );
      } catch (_) {}
      expect(recorder.requests.last.headers.containsKey('X-Tenant-Slug'), isFalse);
    });
  });

  group('TenantSlugInterceptor — mismatch detection', () {
    test('calls onMismatch on 403 with X-Tenant-Slug mismatch body', () async {
      var mismatchCalled = false;
      final (:dio, recorder: _) = _makeDio(
        readSlug: () async => 'acme',
        onMismatch: () async => mismatchCalled = true,
        adapter: MockAdapter(
          statusCode: 403,
          body:
              '{"message":"X-Tenant-Slug does not match authenticated user tenant","statusCode":403,"error":"Forbidden"}',
        ),
      );
      try {
        await dio.get('/dashboard');
      } catch (_) {}
      expect(mismatchCalled, isTrue);
    });

    test('does NOT call onMismatch on regular 403 (permission denied)', () async {
      var mismatchCalled = false;
      final (:dio, recorder: _) = _makeDio(
        readSlug: () async => 'acme',
        onMismatch: () async => mismatchCalled = true,
        adapter: MockAdapter(
          statusCode: 403,
          body: '{"message":"Forbidden resource","statusCode":403}',
        ),
      );
      try {
        await dio.get('/admin-only');
      } catch (_) {}
      expect(mismatchCalled, isFalse,
          reason: 'permission 403 without slug mismatch text must not clear session');
    });

    test('does NOT call onMismatch on 403 from a public (skipAuth) endpoint',
        () async {
      var mismatchCalled = false;
      final (:dio, recorder: _) = _makeDio(
        readSlug: () async => 'acme',
        onMismatch: () async => mismatchCalled = true,
        adapter: MockAdapter(
          statusCode: 403,
          body:
              '{"message":"X-Tenant-Slug does not match authenticated user tenant"}',
        ),
      );
      try {
        await dio.post(
          '/auth/login-staff',
          options: Options(extra: {AuthInterceptor.skipAuthExtra: true}),
        );
      } catch (_) {}
      expect(mismatchCalled, isFalse,
          reason:
              'public endpoints do not carry the slug header, so no mismatch is possible');
    });

    test('does NOT call onMismatch when no slug is stored (no header sent)',
        () async {
      var mismatchCalled = false;
      final (:dio, recorder: _) = _makeDio(
        readSlug: () async => null,
        onMismatch: () async => mismatchCalled = true,
        adapter: MockAdapter(
          statusCode: 403,
          body: '{"message":"X-Tenant-Slug does not match"}',
        ),
      );
      try {
        await dio.get('/dashboard');
      } catch (_) {}
      expect(mismatchCalled, isFalse,
          reason: 'header was not sent so no mismatch can have occurred');
    });

    test('mismatch error still propagates after onMismatch is called',
        () async {
      final (:dio, recorder: _) = _makeDio(
        readSlug: () async => 'acme',
        onMismatch: () async {},
        adapter: MockAdapter(
          statusCode: 403,
          body: '{"message":"X-Tenant-Slug mismatch"}',
        ),
      );
      expect(
        () => dio.get('/dashboard'),
        throwsA(isA<DioException>()),
        reason: 'error must propagate so callers surface a forbidden failure',
      );
    });
  });

  group('Shared-core safety — customer app', () {
    test('customer Dio without TenantSlugInterceptor never sends X-Tenant-Slug',
        () async {
      // Simulate customer DioClientFactory.create (readTenantSlug is null →
      // TenantSlugInterceptor is NOT added).
      final recorder = _FakeHandler();
      final dio = Dio(BaseOptions(baseUrl: 'http://test'));
      // Intentionally: do NOT add TenantSlugInterceptor.
      dio.interceptors.add(recorder);
      dio.httpClientAdapter = MockAdapter(statusCode: 200);
      try {
        await dio.get('/customer/home');
      } catch (_) {}
      expect(recorder.requests.last.headers.containsKey('X-Tenant-Slug'), isFalse,
          reason: 'customer app must never send X-Tenant-Slug');
    });
  });
}
