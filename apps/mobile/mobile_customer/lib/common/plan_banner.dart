import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Reusable installment-plan banner — label on right, amount block on left.
///
/// Used identically on the Home unit card and the My Units card list.
/// Caller formats [amountText] (compact monetary) and [secondaryText].
class PlanBanner extends StatelessWidget {
  const PlanBanner({
    super.key,
    required this.labelText,
    required this.amountText,
    required this.secondaryText,
  });

  final String labelText;   // e.g. "خطة الأقساط"
  final String amountText;  // e.g. "119 ألف ج.م"
  final String secondaryText; // e.g. "شهريًا · 24 شهرًا"

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 72),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppPalette.gold400.withValues(alpha: 0.09),
            AppPalette.gold400.withValues(alpha: 0.04),
          ],
          begin: Alignment.centerRight,
          end: Alignment.centerLeft,
        ),
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(
          color: AppPalette.gold400.withValues(alpha: 0.28),
          width: 0.75,
        ),
      ),
      child: Row(
        textDirection: TextDirection.rtl,
        // spaceBetween: label group pinned to right, amount block pinned to left
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // ── Right: calendar icon + label ──────────────────────────────
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: AppPalette.gold400.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: const Icon(
                  Icons.calendar_month_rounded,
                  size: 16,
                  color: AppPalette.gold500,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                labelText,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppPalette.gold500,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  height: 1.15,
                ),
              ),
            ],
          ),

          // ── Left: amount + secondary (Flexible, never truncated) ───────
          Flexible(
            child: Padding(
              // Minimum gap from the label group regardless of content width
              padding: const EdgeInsetsDirectional.only(start: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: AlignmentDirectional.centerStart,
                    child: Text(
                      amountText,
                      style: const TextStyle(
                        color: AppPalette.gold500,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        height: 1.1,
                      ),
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    secondaryText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppPalette.gold500.withValues(alpha: 0.70),
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      height: 1.1,
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
