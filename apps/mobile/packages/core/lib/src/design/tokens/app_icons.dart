import 'package:flutter/material.dart';

/// Consistent icon sizing scale (mirrors the web's lucide usage: 18px in
/// nav/list rows, 20px inline default, 24px headers/buttons).
abstract final class AppIconSize {
  static const double sm = 18;
  static const double md = 20; // default
  static const double lg = 24;
  static const double xl = 28;
}

/// Curated, semantic icon registry.
///
/// Call sites should use `AppIcons.*` (and [AppIcon] for sizing) rather than
/// raw `Icons.*`, so icon choices stay consistent across both apps and a future
/// switch to a Lucide font package is a single-file change here. We deliberately
/// did NOT add a third-party Lucide package in this phase: the mobile workspace
/// shares one lockfile across `core`, `mobile_customer`, and `mobile_staff`, so
/// a new dependency that fails to resolve would break both apps' analyze/test.
/// Material's rounded set gives a close lucide-style read with zero risk.
abstract final class AppIcons {
  static const home = Icons.home_rounded;
  static const property = Icons.apartment_rounded;
  static const wallet = Icons.account_balance_wallet_rounded;
  static const installments = Icons.event_repeat_rounded;
  static const contract = Icons.description_rounded;
  static const maintenance = Icons.build_rounded;
  static const visit = Icons.event_available_rounded;
  static const notification = Icons.notifications_rounded;
  static const favorite = Icons.favorite_rounded;
  static const profile = Icons.person_rounded;
  static const deposit = Icons.savings_rounded;
  static const chat = Icons.chat_bubble_rounded;
  static const compare = Icons.compare_arrows_rounded;
  static const search = Icons.search_rounded;
  static const document = Icons.folder_rounded;
  static const calendar = Icons.calendar_today_rounded;
  static const location = Icons.location_on_rounded;
  static const chevronForward = Icons.chevron_right_rounded;
}

/// A thin wrapper over [Icon] that enforces the [AppIconSize] scale and, by
/// default, inherits the ambient [IconTheme] color (which the theme sets to the
/// ink color) — so we never hard-code colors at call sites. RTL is handled by
/// Flutter automatically for directional glyphs (e.g. chevrons) when the glyph
/// is the `_rounded` directional variant.
class AppIcon extends StatelessWidget {
  const AppIcon(this.icon, {super.key, this.size = AppIconSize.md, this.color});

  final IconData icon;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => Icon(icon, size: size, color: color);
}
