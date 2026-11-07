import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../common/date_formatter.dart';
import '../design/tokens/app_colors.dart';
import '../design/tokens/app_radii.dart';
import '../design/tokens/app_spacing.dart';

/// The header of every home screen in both apps (staff dashboard, the
/// maintenance supervisor's and the broker's home, the customer's home): a
/// large title, a greeting, chips (the role, today's date) and glass actions
/// (the bell…), on the same navy as [AppNavHeader].
class AppHomeHeader extends StatelessWidget {
  const AppHomeHeader({
    super.key,
    required this.title,
    this.greeting,
    this.chips = const [],
    this.actions = const [],
    this.bottom,
  });

  final String title;
  final String? greeting;

  /// Small pills under the greeting — [HeaderRoleChip], [HeaderDateChip].
  final List<Widget> chips;

  /// Glass buttons at the other end of the title — [NavHeaderAction]s.
  final List<Widget> actions;

  /// Optional content under the title block (filters, a summary).
  final Widget? bottom;

  static Color get _navyDeep => AppPalette.navyDeep;
  static Color get _navyMid => AppPalette.navyMid;
  static Color get _navyLight => AppPalette.navyLight;
  static const _radius = Radius.circular(AppRadii.xl + 4);

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.paddingOf(context).top;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_navyLight, _navyMid, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(bottomLeft: _radius, bottomRight: _radius),
          boxShadow: [BoxShadow(color: Color(0x40000000), blurRadius: 24, offset: Offset(0, 8))],
        ),
        child: Stack(
          children: [
            const Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _Dots()))),
            PositionedDirectional(
              top: 0,
              end: -30,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [AppPalette.gold400.withValues(alpha: 0.13), AppPalette.gold400.withValues(alpha: 0.00)]),
                ),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 40,
              right: 40,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.transparent, AppPalette.gold400.withValues(alpha: 0.50), Colors.transparent],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(AppSpacing.md, topPad + AppSpacing.xs, AppSpacing.md, AppSpacing.md),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.5,
                                height: 1.15,
                              ),
                            ),
                            if (greeting != null && greeting!.isNotEmpty) ...[
                              const SizedBox(height: 3),
                              Text(
                                greeting!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.65),
                                  fontSize: 14,
                                  height: 1.3,
                                ),
                              ),
                            ],
                            if (chips.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Wrap(spacing: AppSpacing.xs, runSpacing: AppSpacing.xxs, children: chips),
                            ],
                          ],
                        ),
                      ),
                      for (final a in actions) ...[const SizedBox(width: AppSpacing.xs), a],
                    ],
                  ),
                  if (bottom != null) ...[const SizedBox(height: AppSpacing.md), bottom!],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The gold pill naming the user's role in a home header.
class HeaderRoleChip extends StatelessWidget {
  const HeaderRoleChip({super.key, required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppPalette.gold400, AppPalette.gold500],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        boxShadow: [
          BoxShadow(color: AppPalette.gold400.withValues(alpha: 0.35), blurRadius: 8, offset: const Offset(0, 3)),
        ],
      ),
      child: Text(
        label,
        style: TextStyle(color: AppPalette.navy, fontSize: 12, fontWeight: FontWeight.w700),
      ),
    );
  }
}

/// The glass pill with today's date in a home header ("2 نوفمبر").
class HeaderDateChip extends StatelessWidget {
  const HeaderDateChip({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        DateFormatter.dayMonth(DateTime.now(), languageCode: lang),
        style: TextStyle(color: Colors.white.withValues(alpha: 0.80), fontSize: 12, fontWeight: FontWeight.w500),
      ),
    );
  }
}

class _Dots extends CustomPainter {
  const _Dots();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 8.0; y < size.height; y += step) {
      for (var x = 8.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_Dots oldDelegate) => false;
}
