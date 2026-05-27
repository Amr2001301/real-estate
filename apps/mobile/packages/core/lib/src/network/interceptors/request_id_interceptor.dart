import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';

/// Attaches a unique `X-Request-Id` to every request for end-to-end tracing
/// (the backend echoes a request id on responses — see api main.ts).
class RequestIdInterceptor extends Interceptor {
  RequestIdInterceptor() : _uuid = const Uuid();

  final Uuid _uuid;
  static const String headerName = 'X-Request-Id';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers.putIfAbsent(headerName, () => _uuid.v4());
    handler.next(options);
  }
}
