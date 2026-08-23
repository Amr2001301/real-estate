import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Splash screen — plays brand video then signals the router to proceed.
//
// Architecture: the router's redirect stays on /splash while
// SplashScreen.splashDone.value == false. Once the video ends (or the timeout
// fires) splashDone is set to true, triggering a router re-evaluation.
// ─────────────────────────────────────────────────────────────────────────────

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  /// Signals the go_router redirect that the intro video has finished.
  static final ValueNotifier<bool> splashDone = ValueNotifier(false);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  VideoPlayerController? _video;

  late AnimationController _fadeCtrl;
  late Animation<double> _fadeIn;

  Timer? _timeout;
  bool _videoReady = false;
  bool _done = false;

  // Guards against "used after disposed" races with video_player's async init.
  bool _stateDisposed = false;
  bool _initCompleted = false;

  static const _kMaxDuration = Duration(seconds: 6);

  @override
  void initState() {
    super.initState();

    // Reset so the router always waits for this instance (survives hot-restart).
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
      _initCompleted = true;

      if (_stateDisposed || !mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) => controller.dispose());
        return;
      }

      await controller.setVolume(0);
      if (_stateDisposed || !mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) => controller.dispose());
        return;
      }

      await controller.setLooping(false);
      if (_stateDisposed || !mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) => controller.dispose());
        return;
      }

      controller.addListener(_onVideoTick);
      setState(() => _videoReady = true);
      _fadeCtrl.forward();
      controller.play().ignore();
    } catch (_) {
      _initCompleted = true;
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
            if (_videoReady)
              FadeTransition(
                opacity: _fadeIn,
                child: _VideoFill(controller: _video!),
              ),
            if (!_videoReady) const _LoadingState(),
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
// Loading state — shows the native splash image while video initialises,
// making the OS splash → Flutter handoff invisible.
// ─────────────────────────────────────────────────────────────────────────────

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
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
// Bottom overlay — gradient + brand wordmark
// ─────────────────────────────────────────────────────────────────────────────

class _BottomOverlay extends StatelessWidget {
  const _BottomOverlay();

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.paddingOf(context).bottom;
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
              Color(0x00000000),
              Color(0xCC0B1726),
              Color(0xFF0B1726),
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
        const SizedBox(height: 10),
        const Text(
          'DEVORA',
          style: TextStyle(
            color: Colors.white,
            fontSize: 22,
            fontWeight: FontWeight.w800,
            letterSpacing: 6,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'STAFF',
          style: TextStyle(
            color: AppPalette.gold300,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 4,
          ),
        ),
      ],
    );
  }
}
