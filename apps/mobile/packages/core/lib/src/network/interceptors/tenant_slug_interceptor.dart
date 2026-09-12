import 'package:dio/dio.dart';

import '../interceptors/auth_interceptor.dart';

/// Reads the current selected-company slug (or null when no tenant is active).
typedef TenantSlugReader = Future<String?> Function();

/// Called when a backend 403 response is identified as a tenant-slug mismatch.
/// The implementor must clear the session (tokens + slug) and sign the user out.
typedef TenantMismatchHandler = Future<void> Function();

/// Injects `X-Tenant-Slug: <slug>` on authenticated staff API requests and
/// detects Phase C tenant-mismatch 403 responses.
///
/// ## Inclusion / exclusion rules
///
/// The header is SKIPPED when any of the following is true:
///   • The request carries [AuthInterceptor.skipAuthExtra] = true (public
///     endpoints: login, refresh, logout, forgot/reset password, catalog,
///     chat). These are unauthenticated and already carry the slug in the
///     request body where required.
///   • No slug is currently stored (fresh install or post-logout state).
///
/// All other authenticated requests receive the header for backend
/// defence-in-depth mismatch detection (Phase C MT-031).
///
/// ## Mismatch detection
///
/// When the backend TenantContextInterceptor rejects a request because the
/// slug header does not match the DB-loaded user company, it returns HTTP 403
/// with a body containing "X-Tenant-Slug". This interceptor detects that
/// specific response, calls [onMismatch] to clear the session, and re-throws
/// so callers surface a generic Forbidden failure.
///
/// Important: the slug header is NEVER used as an authorization source.
/// Backend uses `req.user.companyId` (from JwtStrategy DB reload) as the
/// authoritative tenant. The header is a defense-in-depth hint only.
class TenantSlugInterceptor extends Interceptor {
  TenantSlugInterceptor({
    required TenantSlugReader readSlug,
    TenantMismatchHandler? onMismatch,
  })  : _readSlug = readSlug,
        _onMismatch = onMismatch;

  final TenantSlugReader _readSlug;
  final TenantMismatchHandler? _onMismatch;

  static const String _header = 'X-Tenant-Slug';
  static const String _slugSentExtra = 'tenantSlugSent';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final isPublic = options.extra[AuthInterceptor.skipAuthExtra] == true;
    if (!isPublic) {
      final slug = await _readSlug();
      if (slug != null && slug.isNotEmpty) {
        options.headers[_header] = slug;
        options.extra[_slugSentExtra] = true;
      }
    }
    handler.next(options);
  }

  // Stable machine-readable error code emitted by the backend
  // TenantContextInterceptor on slug/DB-user company disagreement (MT-031).
  static const String _mismatchCode = 'TENANT_CONTEXT_MISMATCH';

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final is403 = err.response?.statusCode == 403;
    final slugWasSent = err.requestOptions.extra[_slugSentExtra] == true;

    if (is403 && slugWasSent && _onMismatch != null) {
      final body = err.response?.data;
      final code = body is Map<String, dynamic> ? body['code'] as String? : null;
      if (code == _mismatchCode) {
        await _onMismatch();
      }
    }

    handler.next(err);
  }
}
