import 'package:core/core.dart';

/// A Company eligible for the shared customer app.
/// Contains only the minimal public fields returned by the discovery endpoints:
/// slug (external tenant identifier) and name (display label).
/// companyId is never stored or transmitted to the client.
class DiscoveredCompany extends Equatable {
  const DiscoveredCompany({required this.slug, required this.name});

  final String slug;
  final String name;

  @override
  List<Object?> get props => [slug, name];
}
