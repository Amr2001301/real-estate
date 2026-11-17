import 'dart:convert';
import 'dart:typed_data';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Answers by path: `/auth/refresh` and anything with an old token → 401.
class _Server implements HttpClientAdapter {
  _Server({required this.refreshOk});
  final bool refreshOk;
  final hits = <String>[];

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? body, Future<void>? cancel) async {
    hits.add('${o.method} ${o.path}');
    if (o.path == '/auth/refresh') {
      return refreshOk ? _json(200, {'accessToken': 'new'}) : _json(401, {'message': 'expired'});
    }
    return o.headers['Authorization'] == 'Bearer new' ? _json(200, {'ok': true}) : _json(401, {'message': 'expired'});
  }

  ResponseBody _json(int status, Object data) => ResponseBody.fromString(jsonEncode(data), status,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]});

  @override
  void close({bool force = false}) {}
}

/// The app's client: the same interceptor, and the refresh call goes through
/// the same Dio (as the staff and customer apps' auth data sources do).
({Dio dio, _Server server, List<String> cleared}) _client({required bool refreshOk}) {
  final server = _Server(refreshOk: refreshOk);
  final cleared = <String>[];
  final opts = BaseOptions(baseUrl: 'http://api.test', validateStatus: (s) => s != null && s >= 200 && s < 300);
  final retry = Dio(opts)..httpClientAdapter = server;
  final dio = Dio(opts)..httpClientAdapter = server;
  dio.interceptors.add(AuthInterceptor(
    retryClient: retry,
    readAccessToken: () async => 'old',
    refreshSession: () async {
      try {
        final r = await dio.post<Map<String, dynamic>>('/auth/refresh',
            options: Options(extra: const {AuthInterceptor.skipAuthExtra: true}));
        return r.data!['accessToken'] as String;
      } on DioException {
        return null;
      }
    },
    invalidateSession: () async => cleared.add('cleared'),
  ));
  return (dio: dio, server: server, cleared: cleared);
}

void main() {
  test('a refused refresh ends the requests (and the session) instead of hanging', () async {
    final c = _client(refreshOk: false);
    final results = Future.wait([
      for (final p in ['/a', '/b', '/c'])
        c.dio.get<dynamic>(p).then((_) => 'ok', onError: (Object e) => (e as DioException).response?.statusCode.toString()),
    ]);
    expect(await results.timeout(const Duration(seconds: 5)), ['401', '401', '401']);
    expect(c.cleared, isNotEmpty);
  });

  test('concurrent 401s share one refresh, then replay with the new token', () async {
    final c = _client(refreshOk: true);
    final results = await Future.wait([for (final p in ['/a', '/b']) c.dio.get<dynamic>(p)])
        .timeout(const Duration(seconds: 5));
    expect(results.map((r) => r.statusCode), [200, 200]);
    expect(c.server.hits.where((h) => h == 'POST /auth/refresh'), hasLength(1));
    expect(c.cleared, isEmpty);
  });
}
