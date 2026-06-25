import 'package:flutter/material.dart';

import '../design/tokens/app_colors.dart';

/// The Devora logo as a small rounded "badge". The brand PNG ships with a baked
/// dark-navy background, so it's clipped into a rounded square with a faint gold
/// rim — reading as an intentional premium mark on any (navy) surface rather
/// than a stray dark rectangle. Decorative only.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 34});

  final double size;

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
      child: Image.asset(
        'assets/brand/devora-logo.png',
        fit: BoxFit.cover,
        excludeFromSemantics: true,
      ),
    );
  }
}
