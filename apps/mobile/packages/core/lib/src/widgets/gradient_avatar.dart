import 'package:flutter/material.dart';

import '../design/theme/app_theme_ext.dart';
import '../design/tokens/app_colors.dart';
import '../design/tokens/app_spacing.dart';

/// A premium avatar mark: a rounded-square gold gradient (gold300→gold500) with
/// navy initials, matching the website account sidebar avatar. Pass [image] to
/// show a photo instead (the gradient remains as the fallback while it loads).
///
/// Use [GradientAvatar.identity] to render the avatar alongside a name + an
/// optional role/subtitle as a single horizontal identity row.
class GradientAvatar extends StatelessWidget {
  const GradientAvatar({
    super.key,
    this.name,
    this.initials,
    this.size = 48,
    this.image,
  })  : role = null,
        _identity = false;

  /// Avatar + name + optional role, laid out as a horizontal row.
  const GradientAvatar.identity({
    super.key,
    required this.name,
    this.role,
    this.size = 52,
    this.image,
    this.initials,
  }) : _identity = true;

  /// Source name used to derive initials when [initials] is not given.
  final String? name;

  /// Explicit initials override (1–2 chars). When null, derived from [name].
  final String? initials;

  final double size;
  final ImageProvider? image;

  /// Role / subtitle shown next to the name in the identity layout.
  final String? role;

  final bool _identity;

  String get _initials {
    final override = initials?.trim() ?? '';
    if (override.isNotEmpty) {
      return override.substring(0, override.length.clamp(1, 2));
    }
    final parts = (name ?? '')
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '—';
    if (parts.length == 1) return parts.first.characters.first;
    return parts.first.characters.first + parts[1].characters.first;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final radius = size * 0.34; // ~rounded-2xl proportion

    final mark = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppPalette.gold300, AppPalette.gold500],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(radius),
        image: image != null
            ? DecorationImage(image: image!, fit: BoxFit.cover)
            : null,
        boxShadow: [
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.45),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: image != null
          ? null
          : Text(
              _initials,
              style: TextStyle(
                color: colors.brandNavy,
                fontWeight: FontWeight.w900,
                fontSize: size * 0.34,
              ),
            ),
    );

    if (!_identity) return mark;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        const SizedBox(width: AppSpacing.sm),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                name ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              if (role != null && role!.isNotEmpty)
                Text(
                  role!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: colors.inkMuted),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
