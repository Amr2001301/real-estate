import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';

/// Cached network image with a brand-gradient fallback (navy → gold) for
/// missing/broken URLs and a soft placeholder while loading.
class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage({super.key, this.url, this.fit = BoxFit.cover});

  final String? url;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    if (url == null || url!.isEmpty) return _Fallback(colors: colors);

    return CachedNetworkImage(
      imageUrl: url!,
      fit: fit,
      fadeInDuration: const Duration(milliseconds: 250),
      placeholder: (_, _) => ColoredBox(color: colors.surfaceSoft),
      errorWidget: (_, _, _) => _Fallback(colors: colors),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.colors});
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [colors.brandNavy, colors.brandGold],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Icon(
          Icons.apartment_rounded,
          color: Colors.white.withValues(alpha: 0.5),
          size: 40,
        ),
      ),
    );
  }
}
