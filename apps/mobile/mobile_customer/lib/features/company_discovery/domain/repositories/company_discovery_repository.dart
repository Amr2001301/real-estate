import 'package:core/core.dart';

import '../entities/discovered_company.dart';

abstract interface class CompanyDiscoveryRepository {
  /// MT-056 — Search eligible Companies by name or slug.
  /// Returns at most 10 results. Empty list when no match.
  Future<Result<List<DiscoveredCompany>>> search(String query);

  /// MT-057 — Exact resolve by slug. Returns null when unavailable.
  /// Never exposes whether the company exists but is inactive.
  Future<Result<DiscoveredCompany?>> resolveBySlug(String slug);
}
