import 'interceptors/tenant_slug_interceptor.dart';

/// Breaks the chicken-and-egg between [TenantSlugInterceptor] (created during
/// [buildAppRoot] before the widget tree exists) and the mismatch handler
/// (which needs widget-tree context to clear the session and show a message).
///
/// [buildAppRoot] creates this registry and passes [call] to
/// [TenantSlugInterceptor] whenever a slug reader is active. The app root
/// (staff or customer) then sets [handler] once the widget tree is ready.
/// Until [handler] is set, [call] is a safe no-op.
class TenantMismatchRegistry {
  TenantMismatchHandler? handler;

  Future<void> call() async {
    if (handler != null) await handler!();
  }
}
