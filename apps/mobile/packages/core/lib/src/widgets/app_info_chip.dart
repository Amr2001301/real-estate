import 'package:flutter/material.dart';

import '../design/tokens/app_radii.dart';

/// A small tinted pill with an icon and a short value (a date, a unit code,
/// a project) on list cards, the same on every card of both apps. The value
/// is cut with «…» when the pill gets less room than it needs — it never
/// spills over the next one.
class AppInfoChip extends StatelessWidget {
  const AppInfoChip({super.key, required this.icon, required this.label, required this.color});

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        border: Border.all(color: color.withValues(alpha: 0.20)),
        borderRadius: AppRadii.pillAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color.withValues(alpha: 0.80)),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color, height: 1.2),
            ),
          ),
        ],
      ),
    );
  }
}
