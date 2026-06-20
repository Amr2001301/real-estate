import 'dart:async';

import 'package:flutter/material.dart';

import '../design/tokens/app_colors.dart';

// Brand palette
const _kNavy = AppPalette.navy;        // 0xFF0F1E33
const _kGold = AppPalette.gold400;     // 0xFFC8A24B
const _kBody = AppPalette.darkInkMuted; // 0xFF9AA6B6

OverlayEntry? _activeBanner;

/// Shows a polished top-slide notification banner over the entire app.
///
/// Supply [overlay] explicitly (from `navigatorKey.currentState?.overlay`) when
/// the caller context is a parent of [MaterialApp] and therefore has no
/// [Overlay] ancestor. Falls back to [Overlay.maybeOf] otherwise.
///
/// Logs `[Banner] overlay unavailable` and returns safely if neither resolves.
/// Replaces any currently visible banner immediately.
void showAppNotificationBanner(
  BuildContext context, {
  required String title,
  required String body,
  VoidCallback? onTap,
  TextDirection textDirection = TextDirection.rtl,
  OverlayState? overlay,
}) {
  debugPrint('[Banner] show requested');

  final resolvedOverlay = overlay ??
      (context.mounted ? Overlay.maybeOf(context, rootOverlay: true) : null);

  if (resolvedOverlay == null) {
    debugPrint('[Banner] overlay unavailable — banner skipped');
    return;
  }

  // Replace the current banner instantly (no outgoing animation) so the new
  // content appears immediately without overlapping.
  _activeBanner?.remove();
  _activeBanner = null;

  var entryRemoved = false;
  late final OverlayEntry entry;

  void dismiss() {
    if (entryRemoved) return;
    entryRemoved = true;
    if (identical(_activeBanner, entry)) _activeBanner = null;
    entry.remove();
    debugPrint('[Banner] dismissed');
  }

  entry = OverlayEntry(
    builder: (_) => _BannerWidget(
      title: title.isEmpty ? 'إشعار جديد' : title,
      body: body,
      textDirection: textDirection,
      onTap: onTap != null
          ? () {
              dismiss();
              onTap();
            }
          : null,
      onDismiss: dismiss,
    ),
  );

  _activeBanner = entry;
  resolvedOverlay.insert(entry);
  debugPrint('[Banner] foreground banner shown');
}

// ── Animated host ─────────────────────────────────────────────────────────────

class _BannerWidget extends StatefulWidget {
  const _BannerWidget({
    required this.title,
    required this.body,
    required this.textDirection,
    required this.onDismiss,
    this.onTap,
  });

  final String title;
  final String body;
  final TextDirection textDirection;
  final VoidCallback? onTap;
  final VoidCallback onDismiss;

  @override
  State<_BannerWidget> createState() => _BannerWidgetState();
}

class _BannerWidgetState extends State<_BannerWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<Offset> _slide;
  late final Animation<double> _fade;
  Timer? _autoTimer;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 340),
    );
    // Slide in from above the screen, easing into rest position.
    _slide = Tween<Offset>(
      begin: const Offset(0, -1.2),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    // Subtle fade so the card doesn't pop harshly.
    _fade = Tween<double>(begin: 0.0, end: 1.0)
        .animate(CurvedAnimation(parent: _ctrl, curve: const Interval(0, 0.6)));

    _ctrl.forward();
    _autoTimer = Timer(const Duration(seconds: 4), _animatedDismiss);
  }

  void _animatedDismiss() {
    if (!mounted) return;
    _autoTimer?.cancel();
    _ctrl.reverse(from: 1.0).then((_) {
      if (mounted) widget.onDismiss();
    });
  }

  @override
  void dispose() {
    _autoTimer?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // viewPadding.top is the physical status-bar/notch inset, stable even when
    // the keyboard is open (unlike padding.top which changes with soft keyboard).
    final topInset = MediaQuery.of(context).viewPadding.top;

    return Positioned(
      top: topInset + 14,
      left: 16,
      right: 16,
      child: Material(
        color: Colors.transparent,
        child: SlideTransition(
          position: _slide,
          child: FadeTransition(
            opacity: _fade,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: widget.onTap,
              onVerticalDragEnd: (d) {
                if ((d.primaryVelocity ?? 0) < -100) _animatedDismiss();
              },
              child: Directionality(
                textDirection: widget.textDirection,
                child: _BannerCard(
                  title: widget.title,
                  body: widget.body,
                  onClose: _animatedDismiss,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Visual card ───────────────────────────────────────────────────────────────

class _BannerCard extends StatelessWidget {
  const _BannerCard({
    required this.title,
    required this.body,
    required this.onClose,
  });

  final String title;
  final String body;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 64, maxHeight: 96),
      decoration: BoxDecoration(
        color: _kNavy,
        borderRadius: BorderRadius.circular(20),
        // Thin gold border — 0.5 px so it reads as a subtle glow, not a frame.
        border: Border.all(
          color: _kGold.withValues(alpha: 0.20),
          width: 0.5,
        ),
        boxShadow: const [
          // Deep shadow for elevation.
          BoxShadow(
            color: Color(0x4D000000),
            blurRadius: 20,
            spreadRadius: -2,
            offset: Offset(0, 8),
          ),
          // Soft ambient shadow.
          BoxShadow(
            color: Color(0x1A000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        // Slightly smaller than the outer radius to keep the border visible.
        borderRadius: BorderRadius.circular(19.5),
        child: Stack(
          children: [
            // ── Leading accent stripe ─────────────────────────────────────
            // PositionedDirectional respects RTL: start = right in Arabic,
            // so the gold stripe appears on the icon side (leading edge).
            PositionedDirectional(
              start: 0,
              top: 0,
              bottom: 0,
              width: 3,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: AlignmentDirectional.topCenter,
                    end: AlignmentDirectional.bottomCenter,
                    colors: [
                      _kGold.withValues(alpha: 0.7),
                      _kGold,
                      _kGold.withValues(alpha: 0.7),
                    ],
                  ),
                ),
              ),
            ),

            // ── Content ──────────────────────────────────────────────────
            // Start padding = 3 (stripe) + 10 (gap) = 13. End = 10.
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(13, 10, 10, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Notification icon
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: _kGold.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: _kGold.withValues(alpha: 0.22),
                        width: 0.5,
                      ),
                    ),
                    child: const Icon(
                      Icons.notifications_outlined,
                      color: _kGold,
                      size: 17,
                    ),
                  ),
                  const SizedBox(width: 10),

                  // Title + body — takes all remaining horizontal space.
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            height: 1.25,
                            letterSpacing: -0.1,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (body.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            body,
                            style: const TextStyle(
                              color: _kBody,
                              fontSize: 12,
                              height: 1.4,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),

                  // Trailing: close button on top, timestamp below.
                  // In RTL this column is on the left (trailing) side.
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Close button has its own GestureDetector so it absorbs
                      // taps before they bubble to the outer card onTap.
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: onClose,
                        child: Padding(
                          padding: const EdgeInsets.all(2),
                          child: Icon(
                            Icons.close_rounded,
                            color: Colors.white.withValues(alpha: 0.35),
                            size: 14,
                          ),
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        'الآن',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.28),
                          fontSize: 10,
                          letterSpacing: 0,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
