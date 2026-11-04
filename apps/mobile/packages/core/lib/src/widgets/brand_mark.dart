import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../branding/brand_tokens.dart';
import '../branding/branding_cubit.dart';

/// The company this app shows: its name and logo, from [BrandingCubit] when
/// the app provides one (the customer app does; the staff app does not).
/// Watches the cubit, so a widget using it rebuilds once branding loads.
({String? name, String? logoUrl}) companyBrandOf(BuildContext context) {
  BrandingCubit? cubit;
  try {
    cubit = context.watch<BrandingCubit>();
  } catch (_) {
    // No branding in this app (staff): nothing to show but the neutral mark.
  }
  final BrandTokens? tokens = cubit?.state;
  String? clean(String? s) => s == null || s.trim().isEmpty ? null : s.trim();
  return (
    name: clean(tokens?.displayName) ?? clean(cubit?.fallbackName),
    logoUrl: clean(tokens?.logoUrl),
  );
}

/// The letters for a badge without a logo. A Latin name gives the first
/// letter of its first two words ("Real Estate" → "RE"); an Arabic name gives
/// one letter, the first of its first word without "ال" ("النخيل" → "ن"),
/// since two Arabic initials rarely read as a monogram.
String brandInitials(String name) {
  final words = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return '';
  if (RegExp(r'[\u0600-\u06FF]').hasMatch(words.first)) {
    var w = words.first;
    if (w.startsWith('ال') && w.runes.length > 3) w = w.substring(2);
    return String.fromCharCode(w.runes.first);
  }
  return words.take(2).map((w) => String.fromCharCode(w.runes.first)).join().toUpperCase();
}

/// The company's logo on a white tile.
///
/// Logos are drawn for a light ground, so the tile is white with room around
/// the logo, and the logo is fitted whole (never cropped). The logo comes
/// from [logoUrl] or, when that is null, from the company's branding. Without
/// a logo (none uploaded, or it fails to load) the tile shows the company's
/// initials in its brand colour; without a name either, a neutral building
/// mark. It never shows another company's logo.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 34, this.logoUrl});

  final double size;
  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    final brand = companyBrandOf(context);
    final url = (logoUrl != null && logoUrl!.isNotEmpty) ? logoUrl : brand.logoUrl;
    final ink = Theme.of(context).colorScheme.secondary;
    final fallback = _Initials(name: brand.name, size: size, color: ink);
    return Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(size * 0.12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(size * 0.26),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.18),
            blurRadius: size * 0.3,
            offset: Offset(0, size * 0.06),
          ),
        ],
      ),
      child: url != null
          ? CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.contain,
              fadeInDuration: const Duration(milliseconds: 200),
              placeholder: (_, _) => const SizedBox.shrink(),
              errorWidget: (_, _, _) => fallback,
            )
          : fallback,
    );
  }
}

class _Initials extends StatelessWidget {
  const _Initials({required this.name, required this.size, required this.color});

  final String? name;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final letters = name == null ? '' : brandInitials(name!);
    return Center(
      child: letters.isEmpty
          ? Icon(Icons.apartment_rounded, size: size * 0.5, color: color)
          : Text(
              letters,
              maxLines: 1,
              textScaler: TextScaler.noScaling,
              style: TextStyle(
                color: color,
                fontSize: size * (letters.length > 1 ? 0.34 : 0.44),
                fontWeight: FontWeight.w800,
                height: 1,
              ),
            ),
    );
  }
}

/// The company's name as text, or nothing when the app does not know it.
class CompanyNameText extends StatelessWidget {
  const CompanyNameText({super.key, this.style, this.maxLines = 1});

  final TextStyle? style;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final name = companyBrandOf(context).name;
    if (name == null) return const SizedBox.shrink();
    return Text(name, style: style, maxLines: maxLines, overflow: TextOverflow.ellipsis);
  }
}
