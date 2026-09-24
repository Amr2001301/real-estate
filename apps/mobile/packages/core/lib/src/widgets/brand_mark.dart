import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../design/tokens/app_colors.dart';

/// The tenant logo rendered as a small rounded badge.
///
/// When [logoUrl] is supplied the image is fetched from the network (cached).
/// On load failure, or when [logoUrl] is null, falls back to the neutral local
/// asset `assets/brand/devora-logo.png`.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 34, this.logoUrl});

  final double size;
  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.28),
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.35),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: logoUrl != null && logoUrl!.isNotEmpty
          ? CachedNetworkImage(
              imageUrl: logoUrl!,
              fit: BoxFit.cover,
              fadeInDuration: const Duration(milliseconds: 200),
              placeholder: (_, _) =>
                  const ColoredBox(color: AppPalette.navy),
              errorWidget: (_, _, _) => Image.asset(
                'assets/brand/devora-logo.png',
                fit: BoxFit.cover,
                excludeFromSemantics: true,
              ),
            )
          : Image.asset(
              'assets/brand/devora-logo.png',
              fit: BoxFit.cover,
              excludeFromSemantics: true,
            ),
    );
  }
}
