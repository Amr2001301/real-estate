import '../../domain/entities/discovered_company.dart';

/// Raw JSON shape returned by GET /v1/public/companies/search and /resolve.
/// No companyId is present in the response.
class DiscoveredCompanyDto {
  const DiscoveredCompanyDto({required this.slug, required this.name});

  final String slug;
  final String name;

  factory DiscoveredCompanyDto.fromJson(Map<String, dynamic> json) =>
      DiscoveredCompanyDto(
        slug: json['slug'] as String,
        name: json['name'] as String,
      );

  DiscoveredCompany toDomain() => DiscoveredCompany(slug: slug, name: name);
}
