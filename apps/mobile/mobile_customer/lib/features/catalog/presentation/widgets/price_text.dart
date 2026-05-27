import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Displays a raw decimal price string formatted + localized (e.g. "5,800,000
/// EGP" / "٥٬٨٠٠٬٠٠٠ ج.م").
class PriceText extends StatelessWidget {
  const PriceText(this.price, {super.key, this.style, this.color});

  final String? price;
  final TextStyle? style;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final text = PriceFormatter.formatString(price, languageCode: lang);
    final base = style ?? Theme.of(context).textTheme.titleMedium;
    return Text(
      text,
      style: base?.copyWith(color: color ?? context.appColors.brandGold),
    );
  }
}
