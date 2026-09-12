import 'package:core/src/network/interceptors/tenant_slug_interceptor.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

// ── Helpers ───────────────────────────────────────────────────────────────────

DioException _make403({required Map<String, dynamic> body, bool slugSent = true}) {
  final ro = RequestOptions(path: '/me/whatever');
  if (slugSent) ro.extra['tenantSlugSent'] = true;
  return DioException(
    requestOptions: ro,
    response: Response(requestOptions: ro, statusCode: 403, data: body),
  );
}

DioException _make403WithCode(String code, {bool slugSent = true}) =>
    _make403(body: {'code': code, 'message': 'some message'}, slugSent: slugSent);

DioException _make403NoCode({bool slugSent = true}) =>
    _make403(body: {'message': 'Forbidden'}, slugSent: slugSent);

// onError is declared `void` but the override body is `async`.
// Pump the microtask queue so the async body finishes before we assert.
Future<void> _fire(TenantSlugInterceptor i, DioException err, _FakeErrorHandler h) async {
  i.onError(err, h);
  await Future<void>.delayed(Duration.zero);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('TenantSlugInterceptor — mismatch detection via error code', () {
    test('TENANT_CONTEXT_MISMATCH code triggers onMismatch and propagates error', () async {
      bool mismatchCalled = false;
      bool handlerNextCalled = false;
      final interceptor = TenantSlugInterceptor(
        readSlug: () async => 'alpha',
        onMismatch: () async { mismatchCalled = true; },
      );
      final handler = _FakeErrorHandler(onNext: (_) { handlerNextCalled = true; });

      await _fire(interceptor, _make403WithCode('TENANT_CONTEXT_MISMATCH'), handler);

      expect(mismatchCalled, isTrue, reason: 'TENANT_CONTEXT_MISMATCH must call onMismatch');
      expect(handlerNextCalled, isTrue, reason: 'Error must still propagate to caller');
    });

    test('ordinary 403 CAPABILITY_NOT_ENABLED does NOT trigger onMismatch', () async {
      bool mismatchCalled = false;
      final interceptor = TenantSlugInterceptor(
        readSlug: () async => 'alpha',
        onMismatch: () async { mismatchCalled = true; },
      );
      final handler = _FakeErrorHandler(onNext: (_) {});

      await _fire(interceptor, _make403WithCode('CAPABILITY_NOT_ENABLED'), handler);

      expect(mismatchCalled, isFalse, reason: 'Other 403 codes must not trigger mismatch');
    });

    test('403 with no code field does NOT trigger onMismatch', () async {
      bool mismatchCalled = false;
      final interceptor = TenantSlugInterceptor(
        readSlug: () async => 'alpha',
        onMismatch: () async { mismatchCalled = true; },
      );
      final handler = _FakeErrorHandler(onNext: (_) {});

      await _fire(interceptor, _make403NoCode(), handler);

      expect(mismatchCalled, isFalse);
    });

    test('TENANT_CONTEXT_MISMATCH without slug-sent flag does NOT trigger onMismatch', () async {
      bool mismatchCalled = false;
      final interceptor = TenantSlugInterceptor(
        readSlug: () async => 'alpha',
        onMismatch: () async { mismatchCalled = true; },
      );
      final handler = _FakeErrorHandler(onNext: (_) {});

      await _fire(interceptor, _make403WithCode('TENANT_CONTEXT_MISMATCH', slugSent: false), handler);

      expect(mismatchCalled, isFalse, reason: 'Guard only fires when slug was actually sent');
    });

    test('non-403 response never triggers onMismatch', () async {
      bool mismatchCalled = false;
      final interceptor = TenantSlugInterceptor(
        readSlug: () async => 'alpha',
        onMismatch: () async { mismatchCalled = true; },
      );
      final handler = _FakeErrorHandler(onNext: (_) {});
      final ro = RequestOptions(path: '/me/x')..extra['tenantSlugSent'] = true;
      final err500 = DioException(
        requestOptions: ro,
        response: Response(
          requestOptions: ro,
          statusCode: 500,
          data: {'code': 'TENANT_CONTEXT_MISMATCH'},
        ),
      );

      await _fire(interceptor, err500, handler);

      expect(mismatchCalled, isFalse, reason: 'Only 403 triggers mismatch check');
    });
  });
}

class _FakeErrorHandler extends ErrorInterceptorHandler {
  _FakeErrorHandler({required void Function(DioException) onNext}) : _onNext = onNext;
  final void Function(DioException) _onNext;

  @override
  void next(DioException err) => _onNext(err);

  @override
  void resolve(Response response) {}

  @override
  void reject(DioException err, [bool callFollowingErrorInterceptor = false]) {}
}
