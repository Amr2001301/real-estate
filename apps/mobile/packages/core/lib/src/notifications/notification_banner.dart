import 'dart:async';

import 'package:flutter/material.dart';

import '../design/tokens/app_colors.dart';

// Brand constants — source: AppPalette
const _kNavy   = AppPalette.navy;           // 0xFF0F1E33
const _kGold   = AppPalette.gold400;        // 0xFFC8A24B
const _kBody   = AppPalette.darkInkMuted;   // 0xFF9AA6B6

OverlayEntry? _activeBanner;

/// Shows a branded top-slide notification banner over the entire app.
///
/// Pass [overlay] explicitly (from `navigatorKey.currentState?.overlay`) when
/// the [context] does not have an [Overlay] ancestor — which is the case for
/// root-level State objects whose context is a parent of [MaterialApp].
///
/// Falls back to [Overlay.maybeOf] on [context] when [overlay] is null.
/// Logs `[Banner] overlay unavailable` and returns silently if neither
/// resolves — the app is never crashed by a missing banner.
///
/// If a banner is already visible it is replaced immediately.
/// Auto-dismisses after ~4.5 s; swipe-up or the × button also dismiss.
void showAppNotificationBanner(
  BuildContext context, {
  required String title,
  required String body,
  VoidCallback? onTap,
  TextDirection textDirection = TextDirection.rtl,
  OverlayState? overlay,
}) {
  debugPrint('[Banner] show requested');

  // Prefer an explicitly supplied overlay (e.g. from a GlobalKey<NavigatorState>)
  // so that callers whose BuildContext is above MaterialApp still work.
  final resolvedOverlay = overlay ??
      (context.mounted ? Overlay.maybeOf(context, rootOverlay: true) : null);

  if (resolvedOverlay == null) {
    debugPrint('[Banner] overlay unavailable — banner skipped');
    return;
  }

  // Remove any existing banner without animation so the new one appears clean.
  _activeBanner?.remove();
  _activeBanner = null;

  var entryRemoved = false;
  late final OverlayEntry entry;

  void dismiss() {
    if (entryRemoved) return;
    entryRemoved = true;
    if (identical(_activeBanner, entry)) _activeBanner = null;
    entry.remove();
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
  debugPrint('[Banner] overlay inserted');
}

// ── Animation widget ──────────────────────────────────────────────────────────

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
      duration: const Duration(milliseconds: 380),
    );
    _slide = Tween<Offset>(
      begin: const Offset(0, -1.4),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);

    _ctrl.forward();
    _autoTimer = Timer(const Duration(milliseconds: 4500), _animatedDismiss);
  }

  void _animatedDismiss() {
    if (!mounted) return;
    _autoTimer?.cancel();
    _ctrl.reverse().then((_) {
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
    // viewPadding.top = status bar height (stable even when keyboard opens).
    final topInset = MediaQuery.of(context).viewPadding.top;
    return Positioned(
      top: topInset + 10,
      left: 12,
      right: 12,
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
                // Swipe-up to dismiss.
                if ((d.primaryVelocity ?? 0) < -150) _animatedDismiss();
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
      decoration: BoxDecoration(
        color: _kNavy,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _kGold.withValues(alpha: 0.28),
          width: 1,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x55000000),
            blurRadius: 28,
            spreadRadius: -2,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Gold top accent bar ──────────────────────────────────────
            Container(
              height: 2,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    _kGold.withValues(alpha: 0.0),
                    _kGold,
                    _kGold.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
            // ── Content row ─────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 8, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Icon container
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: _kGold.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(11),
                      border: Border.all(
                        color: _kGold.withValues(alpha: 0.30),
                        width: 1,
                      ),
                    ),
                    child: const Icon(
                      Icons.notifications_outlined,
                      color: _kGold,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  // Text content
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Title row + timestamp
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(
                              child: Text(
                                title,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  height: 1.3,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'الآن',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.38),
                                fontSize: 10.5,
                              ),
                            ),
                          ],
                        ),
                        if (body.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            body,
                            style: const TextStyle(
                              color: _kBody,
                              fontSize: 12.5,
                              height: 1.4,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  // Close button — its own GestureDetector absorbs the tap
                  // before it bubbles up to the parent card's onTap (navigate).
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: onClose,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(8, 2, 4, 4),
                      child: Icon(
                        Icons.close_rounded,
                        color: Colors.white.withValues(alpha: 0.40),
                        size: 16,
                      ),
                    ),
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
