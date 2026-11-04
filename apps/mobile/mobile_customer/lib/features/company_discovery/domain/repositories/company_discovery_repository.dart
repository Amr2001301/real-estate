import 'package:core/core.dart';

import '../entities/discovered_company.dart';

abstract interface class CompanyDiscoveryRepository {
  /// MT-057 — Exact resolve by slug. Returns null when unavailable.
  /// Never exposes whether the company exists but is inactive.
  Future<Result<DiscoveredCompany?>> resolveBySlug(String slug);
}
