import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// Navy depth scale matching the Devora design language.
const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF0F1E32);

/// Branded splash shown while the persisted session resolves.
/// Mirrors the customer app's cinematic navy style with the brand mark,
/// gold wordmark, dot texture, and a subtle spinner.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeIn);
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _navyDeep,
      body: Stack(
        children: [
          // Dot texture overlay
          const Positioned.fill(
            child: IgnorePointer(child: _SplashDots()),
          ),
          // Gold radial bloom — top-end corner
          PositionedDirectional(
            top: -60,
            end: -60,
            child: Container(
              width: 320,
              height: 320,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0x22C8A24B), Color(0x00C8A24B)],
                  stops: [0.0, 0.70],
                ),
              ),
            ),
          ),
          // Secondary bloom — bottom-start
          PositionedDirectional(
            bottom: -40,
            start: -60,
            child: Container(
              width: 240,
              height: 240,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0x14C8A24B), Color(0x00C8A24B)],
                  stops: [0.0, 0.7],
                ),
              ),
            ),
          ),
          // Bottom gradient vignette
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            height: 200,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x000B1726), _navyMid],
                ),
              ),
            ),
          ),
          // Centred content: brand mark + wordmark + spinner
          Center(
            child: FadeTransition(
              opacity: _fade,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Brand mark with gold ring
                  Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(88 * 0.28),
                      border: Border.all(
                        color: AppPalette.gold400.withValues(alpha: 0.50),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppPalette.gold400.withValues(alpha: 0.18),
                          blurRadius: 28,
                          spreadRadius: 4,
                        ),
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.30),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Image.asset(
                      'assets/brand/devora-logo.png',
                      fit: BoxFit.cover,
                      excludeFromSemantics: true,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  // Gold accent line
                  Container(
                    width: 40,
                    height: 2,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [
                          Color(0x00B8941F),
                          AppPalette.gold400,
                          Color(0x00B8941F),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  // "DEVORA" wordmark
                  Text(
                    'DEVORA',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 6,
                      height: 1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  // "STAFF" sub-wordmark in gold
                  Text(
                    'STAFF',
                    style: TextStyle(
                      color: AppPalette.gold300,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 4,
                      height: 1,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxl),
                  // Gold spinner
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppPalette.gold400.withValues(alpha: 0.70),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SplashDots extends StatelessWidget {
  const _SplashDots();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotsPainter(), child: SizedBox.expand());
}

class _DotsPainter extends CustomPainter {
  const _DotsPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 24.0;
    for (var y = 8.0; y < size.height; y += step) {
      for (var x = 8.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotsPainter _) => false;
}
