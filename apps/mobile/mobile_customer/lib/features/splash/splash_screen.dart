import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Splash screen
//
// Architecture note: the router's redirect stays on /splash while
// SplashScreen.splashDone.value == false. The screen plays the brand video
// once, then sets splashDone = true, which triggers the router to proceed.
// A timeout ensures we never block navigation if the video stalls.
// ─────────────────────────────────────────────────────────────────────────────

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  /// Signals the go_router redirect that the intro video has finished.
  /// The router merges this into its refreshListenable so it re-evaluates
  /// the redirect the moment this flips to true.
  static final ValueNotifier<bool> splashDone = ValueNotifier(false);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  // Nullable so we can safely guard every access.
  VideoPlayerController? _video;

  late AnimationController _fadeCtrl;
  late Animation<double> _fadeIn;

  Timer? _timeout;
  bool _videoReady = false;
  bool _done = false;

  // Set to true the moment dispose() is called. _initVideo() checks this
  // flag after every await and disposes the controller itself if the state
  // was torn down mid-initialisation (prevents the "used after disposed"
  // crash caused by video_player's internal seekTo → _updatePosition path).
  bool _stateDisposed = false;

  // True once VideoPlayerController.initialize() has returned (success or
  // failure). When false, dispose() must NOT touch the controller — the
  // _initVideo future owns it and will clean up when it detects the flag.
  bool _initCompleted = false;

  static const _kMaxDuration = Duration(seconds: 6);

  @override
  void initState() {
    super.initState();

    // splashDone is a static ValueNotifier that survives hot-restarts.
    // Reset it so the router always waits for this instance, even if a
    // previous run already set it to true (which causes an immediate unmount
    // race that crashes the VideoPlayerController mid-initialize).
    SplashScreen.splashDone.value = false;

    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeIn = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeIn);

    _timeout = Timer(_kMaxDuration, _markDone);
    _initVideo();
  }

  Future<void> _initVideo() async {
    final controller = VideoPlayerController.asset(
      'assets/brand/real_estate_video_splash.mp4',
    );
    _video = controller;

    try {
      await controller.initialize();
      // initialize() is done — ownership passes back to the state.
      _initCompleted = true;

      // If the state was disposed while we were awaiting, clean up here
      // (dispose() skipped the controller because _initCompleted was false).
      // Delay by one frame so any pending platform-channel callbacks
      // (seekTo → _updatePosition) can drain before dispose() runs,
      // preventing the "VideoPlayerController used after being disposed" crash.
      if (_stateDisposed || !mounted) {
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => controller.dispose(),
        );
        return;
      }

      await controller.setVolume(0); // muted splash
      if (_stateDisposed || !mounted) {
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => controller.dispose(),
        );
        return;
      }

      await controller.setLooping(false);
      if (_stateDisposed || !mounted) {
        WidgetsBinding.instance.addPostFrameCallback(
          (_) => controller.dispose(),
        );
        return;
      }

      controller.addListener(_onVideoTick);
      setState(() => _videoReady = true);
      _fadeCtrl.forward();
      controller.play().ignore(); // fire-and-forget; no await to race on
    } catch (_) {
      _initCompleted = true;
      // Video unavailable — show static branded screen briefly, then proceed.
      if (!_stateDisposed && mounted) {
        Future.delayed(const Duration(milliseconds: 1800), _markDone);
      }
    }
  }

  void _onVideoTick() {
    if (_stateDisposed || _done || !_videoReady) return;
    final ctrl = _video;
    if (ctrl == null) return;
    final pos = ctrl.value.position;
    final dur = ctrl.value.duration;
    if (dur > Duration.zero && pos >= dur - const Duration(milliseconds: 150)) {
      _markDone();
    }
  }

  void _markDone() {
    if (_done) return;
    _done = true;
    _timeout?.cancel();
    SplashScreen.splashDone.value = true;
  }

  @override
  void dispose() {
    _stateDisposed = true;
    _timeout?.cancel();
    // Only dispose the controller here if initialization has already
    // completed. Otherwise _initVideo() will dispose it once it detects
    // the _stateDisposed flag — preventing the race-condition crash.
    if (_initCompleted) {
      _video?.removeListener(_onVideoTick);
      _video?.dispose();
    }
    _fadeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B1726),
        body: Stack(
          fit: StackFit.expand,
          children: [
            // ── Video (fades in once initialized) ──────────────────────────
            if (_videoReady)
              FadeTransition(
                opacity: _fadeIn,
                child: _VideoFill(controller: _video!),
              ),

            // ── Static overlay while video loads ───────────────────────────
            if (!_videoReady) const _LoadingState(),

            // ── Persistent bottom gradient + brand mark ─────────────────────
            const _BottomOverlay(),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Video fill — covers the full screen proportionally
// ─────────────────────────────────────────────────────────────────────────────

class _VideoFill extends StatelessWidget {
  const _VideoFill({required this.controller});
  final VideoPlayerController controller;

  @override
  Widget build(BuildContext context) {
    return FittedBox(
      fit: BoxFit.cover,
      child: SizedBox(
        width: controller.value.size.width,
        height: controller.value.size.height,
        child: VideoPlayer(controller),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading state — navy bg + logo + animated gold dots
// Shown while the video controller initialises (typically < 300 ms).
// Mirrors the native splash so the transition is invisible.
// ─────────────────────────────────────────────────────────────────────────────

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    // Fill the screen with the same image used by the native splash so the
    // handoff from OS splash → Flutter loading → video is seamless.
    return Image.asset(
      'assets/brand/flutter_native_splash.png',
      fit: BoxFit.cover,
      width: double.infinity,
      height: double.infinity,
      filterQuality: FilterQuality.high,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom overlay — gradient + wordmark
// Always visible (composited over the video) so the brand is anchored.
// ─────────────────────────────────────────────────────────────────────────────

class _BottomOverlay extends StatelessWidget {
  const _BottomOverlay();

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    // Single container: transparent at top → solid navy at bottom.
    // This eliminates the hard rectangular seam that appeared when a separate
    // solid-colour Container was stacked beneath a gradient Container.
    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.only(top: 130, bottom: bottomPad + 36),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0x00000000),   // fully transparent
              Color(0xCC0B1726),   // ~80 % navy
              Color(0xFF0B1726),   // fully opaque navy
            ],
            stops: [0.0, 0.5, 1.0],
          ),
        ),
        child: const _Wordmark(),
      ),
    );
  }
}

class _Wordmark extends StatelessWidget {
  const _Wordmark();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Gold accent line
        Container(
          width: 40,
          height: 2,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppPalette.gold300, AppPalette.gold500],
            ),
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          'REAL ESTATE',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.45),
            fontSize: 10,
            fontWeight: FontWeight.w500,
            letterSpacing: 3.5,
          ),
        ),
      ],
    );
  }
}
