import 'package:flutter/widgets.dart';

/// Tenant-supplied branding overrides.
///
/// All fields are nullable — absent fields fall back to the default
/// navy/gold palette. Parsed from GET /public/branding; never throws.
@immutable
class BrandTokens {
  const BrandTokens({
    this.primaryColor,
    this.accentColor,
    this.logoUrl,
    this.displayName,
  });

  /// Overrides the brand navy (`AppPalette.navy`). Used as the primary dark
  /// surface color, app bar, and filled-button background.
  final Color? primaryColor;

  /// Overrides the brand gold (`AppPalette.gold400`). Used as the accent /
  /// interactive highlight color.
  final Color? accentColor;

  /// Remote URL for the tenant's logo image. Loaded by [BrandMark] with a
  /// neutral local asset fallback.
  final String? logoUrl;

  /// Tenant display name (prefers `displayName`, falls back to `name`).
  final String? displayName;

  factory BrandTokens.fromJson(Map<String, dynamic> json) {
    return BrandTokens(
      primaryColor: _parseHex(json['primaryColor'] as String?),
      accentColor: _parseHex(json['accentColor'] as String?),
      logoUrl: json['logoUrl'] as String?,
      displayName: (json['displayName'] ?? json['name']) as String?,
    );
  }

  static Color? _parseHex(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    final s = hex.trim().replaceFirst('#', '');
    if (s.length != 6) return null;
    final val = int.tryParse(s, radix: 16);
    if (val == null) return null;
    return Color(0xFF000000 | val);
  }
}
