/// Tenant-aware auth feature flag.
///
/// When true: the app resolves its company at start (blocking on a retry
/// screen when the company cannot be reached or is switched off), session
/// restore requires the company to be valid, and all auth flows use V2
/// tenant-aware endpoints with the slug in the request body.
///
/// The company itself always comes from the build (COMPANY_SLUG): every
/// customer app is one company's, and there is no company picker.
///
/// Activated in K2 after full tenant-aware auth migration. This is a ROLLOUT
/// SWITCH, not a security boundary.
const bool kEnableCustomerTenantSelection = true;
