import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../notifications/presentation/widgets/notifications_bell.dart';

/// The staff home's hero (with the notifications bell); the rest of the kit lives in `core`.
// ── Hero ─────────────────────────────────────────────────────────────────────

class HomeHero extends StatelessWidget {
  const HomeHero({
    super.key,
    required this.name,
    required this.roleLabel,
    this.companyName,
    this.logoUrl,
    this.bellRoute = '/notifications',
  });

  final String name;
  final String roleLabel;
  final String? companyName;
  final String? logoUrl;
  final String bellRoute;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final parts = name.trim().split(RegExp(r'\s+'));
    final first = parts.isEmpty ? name : parts.first;
    final rest = parts.length > 1 ? parts.sublist(1).join(' ') : '';
    final now = DateTime.now();
    final top = MediaQuery.paddingOf(context).top;

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(36)),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppPalette.navy700, AppPalette.navy, Color(0xFF0B1727)],
          ),
        ),
        child: Stack(
          children: [
            const Positioned.fill(child: CustomPaint(painter: HomeHeroPainter())),
            Padding(
              padding: EdgeInsets.fromLTRB(18, top + 14, 18, 100),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (logoUrl != null || companyName != null) ...[
                        Container(
                          width: 36,
                          height: 36,
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(11)),
                          alignment: Alignment.center,
                          child: logoUrl != null
                              ? Image.network(logoUrl!, fit: BoxFit.contain, errorBuilder: (_, _, _) => _LogoInitials(companyName))
                              : _LogoInitials(companyName),
                        ),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Text(
                            companyName ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: AppPalette.gold200, fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ] else
                        const Spacer(),
                      NotificationsBell(route: bellRoute),
                    ],
                  ),
                  const SizedBox(height: 22),
                  Text(now.hour < 12 ? l10n.shGreetMorning : l10n.shGreetEvening,
                      style: const TextStyle(color: Color(0xFFC9D2DE), fontSize: 13)),
                  const SizedBox(height: 2),
                  Text.rich(
                    TextSpan(children: [
                      TextSpan(text: first, style: homeDisplay(30, Colors.white)),
                      if (rest.isNotEmpty) TextSpan(text: ' $rest', style: homeDisplay(30, AppPalette.gold300)),
                    ]),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _HeroTag(gold: true, icon: Icons.verified_rounded, label: roleLabel),
                      _HeroTag(
                        icon: Icons.calendar_today_rounded,
                        label: '${DateFormatter.weekdayShort(now, languageCode: lang)} ${DateFormatter.dayMonth(now, languageCode: lang)}',
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

class _LogoInitials extends StatelessWidget {
  const _LogoInitials(this.name);
  final String? name;

  @override
  Widget build(BuildContext context) => Text(homeInitials(name), style: homeDisplay(13, AppPalette.navy));
}

class _HeroTag extends StatelessWidget {
  const _HeroTag({required this.icon, required this.label, this.gold = false});
  final IconData icon;
  final String label;
  final bool gold;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
        decoration: BoxDecoration(
          gradient: gold ? homeGoldGradient : null,
          color: gold ? null : Colors.white.withValues(alpha: 0.07),
          border: gold ? null : Border.all(color: Colors.white.withValues(alpha: 0.12)),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: gold ? AppPalette.navy : const Color(0xFFDCE3EC)),
            const SizedBox(width: 5),
            Text(label,
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: gold ? AppPalette.navy : const Color(0xFFDCE3EC))),
          ],
        ),
      );
}

