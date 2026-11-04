import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../dashboard/home_kit/home_kit.dart';

/// Pieces shared by the catalog pages (projects, units, a project, a unit),
/// in the homes' look (owner-approved designs, 2026-11-04).

/// The unit status colours, as the website's inventory bars.
const catalogAvailable = Color(0xFF3E7C5A);
const catalogReserved = Color(0xFFC98A2B);
const catalogSold = AppPalette.navy600;

Color unitStatusColor(String status) => switch (status) {
      'AVAILABLE' => catalogAvailable,
      'RESERVED' => catalogReserved,
      'SOLD' => catalogSold,
      _ => const Color(0xFF8A7F70),
    };

/// The project type's name, as on the website's project form.
String projectTypeLabel(AppLocalizations l10n, String? type) => switch (type) {
      'RESIDENTIAL' => l10n.cpTypeResidential,
      'COASTAL' => l10n.cpTypeCoastal,
      'ADMINISTRATIVE' => l10n.cpTypeAdministrative,
      'COMMERCIAL' => l10n.cpTypeCommercial,
      'MEDICAL' => l10n.cpTypeMedical,
      'MIXED_USE' => l10n.cpTypeMixedUse,
      _ => '',
    };

/// A cover photo, or the navy skyline when there is none.
class CatalogCover extends StatelessWidget {
  const CatalogCover({super.key, this.url, this.height = 150, this.child});
  final String? url;
  final double height;

  /// Drawn over the photo's dark bottom (badges, the name).
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final hasPhoto = (url ?? '').isNotEmpty;
    return SizedBox(
      height: height,
      child: Stack(fit: StackFit.expand, children: [
        if (hasPhoto)
          AppNetworkImage(url: url)
        else
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF3A5578), AppPalette.navy700, AppPalette.navy],
              ),
            ),
            child: CustomPaint(painter: CatalogSkylinePainter()),
          ),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              stops: [0.3, 1],
              colors: [Colors.transparent, Color(0xE00B1727)],
            ),
          ),
        ),
        ?child,
      ]),
    );
  }
}

/// The gold-lined skyline drawn where there is no photo.
class CatalogSkylinePainter extends CustomPainter {
  const CatalogSkylinePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final glow = Paint()
      ..shader = RadialGradient(colors: [AppPalette.gold400.withValues(alpha: 0.30), Colors.transparent])
          .createShader(Rect.fromCircle(center: Offset(size.width * 0.2, size.height * 0.1), radius: size.width * 0.6));
    canvas.drawRect(Offset.zero & size, glow);
    // Building tops as fractions of the width / of a 90-high band.
    const tops = [
      [0.0, 0.33], [0.05, 0.53], [0.09, 0.33], [0.12, 0.67], [0.19, 0.47], [0.24, 0.58], [0.28, 0.78], [0.36, 0.51],
      [0.40, 0.40], [0.44, 0.60], [0.50, 0.71], [0.53, 0.87], [0.58, 0.49], [0.65, 0.60], [0.71, 0.38], [0.75, 0.56],
      [0.79, 0.80], [0.87, 0.47], [0.92, 0.67], [1.0, 0.0],
    ];
    final band = size.height * 0.6;
    final path = Path()..moveTo(0, size.height);
    for (var i = 0; i < tops.length - 1; i++) {
      final x = tops[i][0] * size.width;
      final nx = tops[i + 1][0] * size.width;
      final y = size.height - tops[i][1] * band;
      path
        ..lineTo(x, y)
        ..lineTo(nx, y);
    }
    path
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = AppPalette.gold300.withValues(alpha: 0.10));
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = AppPalette.gold300.withValues(alpha: 0.45),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// A small rounded badge: a status, "featured", a type.
class CatalogBadge extends StatelessWidget {
  const CatalogBadge({super.key, required this.label, required this.background, required this.foreground, this.icon, this.border});
  final String label;
  final Color background;
  final Color foreground;
  final IconData? icon;
  final Color? border;

  factory CatalogBadge.status(String label, Color color, {IconData? icon}) =>
      CatalogBadge(label: label, background: Color.alphaBlend(color.withValues(alpha: 0.14), Colors.white), foreground: color, icon: icon);

  factory CatalogBadge.gold(String label, {IconData? icon}) =>
      CatalogBadge(label: label, background: AppPalette.gold400, foreground: AppPalette.navy, icon: icon);

  factory CatalogBadge.glass(String label) => CatalogBadge(
        label: label,
        background: Colors.white.withValues(alpha: 0.14),
        foreground: Colors.white,
        border: Colors.white.withValues(alpha: 0.22),
      );

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(99),
          border: border == null ? null : Border.all(color: border!),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 13, color: foreground), const SizedBox(width: 3)],
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: foreground)),
        ]),
      );
}

/// The project's units as one bar (available, reserved, sold) with the
/// counts under it, as the website's units bar.
class CatalogUnitsMix extends StatelessWidget {
  const CatalogUnitsMix({super.key, required this.available, required this.reserved, required this.sold, this.other = 0});
  final int available;
  final int reserved;
  final int sold;
  final int other;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final total = available + reserved + sold + other;
    if (total == 0) {
      return Text(l10n.cpNoUnits, style: TextStyle(fontSize: 12, color: colors.inkMuted));
    }
    Widget seg(int n, Color c) => n == 0 ? const SizedBox.shrink() : Expanded(flex: n, child: ColoredBox(color: c));
    Widget legend(String label, int n, Color c) => Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 7, height: 7, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 11, color: colors.inkMuted)),
          const SizedBox(width: 3),
          Text(ltr('$n'), style: homeDisplay(12, colors.inkStrong)),
        ]);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: SizedBox(
          height: 8,
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            seg(available, catalogAvailable),
            seg(reserved, catalogReserved),
            seg(sold, catalogSold),
            seg(other, const Color(0xFFB8AE9F)),
          ]),
        ),
      ),
      const SizedBox(height: 7),
      Wrap(spacing: 12, runSpacing: 4, children: [
        legend(l10n.unitStatusAvailable, available, catalogAvailable),
        legend(l10n.unitStatusReserved, reserved, catalogReserved),
        legend(l10n.unitStatusSold, sold, catalogSold),
      ]),
    ]);
  }
}
