import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Splash screen
//
// The router's redirect stays on /splash while SplashScreen.splashDone.value ==
// false. The screen shows the COMPANY's own mark — its logo on its brand colour
// and its name — then sets splashDone = true so the router proceeds.
//
// There is deliberately nothing of the platform here: no platform logo, no
// platform name, no stock footage. The brand colours come from the palette the
// app applies from the company's branding; the logo and name come from
// BrandingCubit (the saved copy of the last branding shows at once, so a
// returning user sees their company's logo from the first frame).
// ─────────────────────────────────────────────────────────────────────────────

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  /// Signals the go_router redirect that the splash has finished.
  /// The router merges this into its refreshListenable so it re-evaluates
  /// the redirect the moment this flips to true.
  static final ValueNotifier<bool> splashDone = ValueNotifier(false);

  /// How long the mark stays before the app opens.
  static const holdDuration = Duration(milliseconds: 1800);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _intro;
  late final Animation<double> _fade;
  late final Animation<double> _scale;
  Timer? _hold;

  @override
  void initState() {
    super.initState();
    // A static notifier survives hot restarts: reset it so the router always
    // waits for this instance.
    SplashScreen.splashDone.value = false;

    _intro = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
    _fade = CurvedAnimation(parent: _intro, curve: Curves.easeOut);
    _scale = Tween<double>(begin: 0.92, end: 1).animate(CurvedAnimation(parent: _intro, curve: Curves.easeOutBack));
    _intro.forward();
    _hold = Timer(SplashScreen.holdDuration, () => SplashScreen.splashDone.value = true);
  }

  @override
  void dispose() {
    _hold?.cancel();
    _intro.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final brand = companyBrandOf(context);
    final theme = Theme.of(context);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppPalette.navyDeep,
        body: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppPalette.navy, AppPalette.navyDeep],
            ),
          ),
          child: SizedBox.expand(
            child: Center(
              child: FadeTransition(
                opacity: _fade,
                child: ScaleTransition(
                  scale: _scale,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const BrandMark(size: 112),
                      const SizedBox(height: 28),
                      if (brand.name != null)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 40),
                          child: Text(
                            brand.name!,
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.headlineSmall?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              height: 1.25,
                            ),
                          ),
                        ),
                      const SizedBox(height: 18),
                      // The company's accent colour as a fine rule.
                      Container(
                        width: 44,
                        height: 2,
                        decoration: BoxDecoration(
                          color: AppPalette.gold400,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
