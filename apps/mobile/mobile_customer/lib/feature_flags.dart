/// Tenant-selection feature flag.
///
/// When true: company-selector screen is shown on first launch (and when the
/// session is cleared via changeCompany), session restore requires a saved slug,
/// and all auth flows use V2 tenant-aware endpoints with slug in the request body.
///
/// Activated in K2 after full tenant-aware auth migration. This is a ROLLOUT
/// SWITCH, not a security boundary.
const bool kEnableCustomerTenantSelection = true;
