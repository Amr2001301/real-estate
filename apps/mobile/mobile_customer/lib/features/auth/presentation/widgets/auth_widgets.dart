import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../../../common/brand_mark.dart';

// Navy depth constants — shared design language.
const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);
const _navyLight = Color(0xFF2A4E7C);

/// Premium navy hero header for auth screens — completely redesigned.
///
/// Layout: back button pinned to top-end → brand mark centered → title (large,
/// centered) → subtitle → gold accent line. The gradient is deeper and richer
/// than the old version, with a stronger gold bloom and two glow layers.
class AuthHeader extends StatelessWidget {
  const AuthHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.onBack,
  });

  final String title;
  final String subtitle;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);

    return ClipRRect(
      borderRadius: const BorderRadius.only(
        bottomLeft: Radius.circular(AppRadii.xxl + 4),
        bottomRight: Radius.circular(AppRadii.xxl + 4),
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          boxShadow: context.appColors.shadowLift,
        ),
        child: Stack(
          children: [
            // Deep navy base gradient
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment(0.5, -1.1),
                    radius: 1.7,
                    colors: [_navyLight, _navyMid, _navyDeep],
                    stops: [0.0, 0.50, 1.0],
                  ),
                ),
              ),
            ),
            // Dot texture
            const Positioned.fill(
              child: IgnorePointer(child: _DotTexture()),
            ),
            // Gold bloom — top-end corner (larger, warmer)
            PositionedDirectional(
              top: 0,
              end: -20,
              child: Container(
                width: 240,
                height: 240,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x28C8A24B), Color(0x00C8A24B)],
                    stops: [0.0, 0.65],
                  ),
                ),
              ),
            ),
            // Secondary gold bloom — bottom-start (depth layer)
            PositionedDirectional(
              bottom: -20,
              start: -40,
              child: Container(
                width: 160,
                height: 160,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x14C8A24B), Color(0x00C8A24B)],
                    stops: [0.0, 0.7],
                  ),
                ),
              ),
            ),
            // Content
            SafeArea(
              bottom: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Back button row — pinned to top-end
                  Padding(
                    padding: const EdgeInsetsDirectional.only(
                      top: AppSpacing.xs,
                      end: AppSpacing.lg,
                    ),
                    child: Align(
                      alignment: AlignmentDirectional.centerEnd,
                      child: _GlassBack(onTap: onBack ?? () {}),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Brand mark — centred, larger
                  const BrandMark(size: 54),
                  const SizedBox(height: AppSpacing.xs),

                  // Eyebrow label
                  Text(
                    l10n.authEyebrow,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: AppPalette.gold300,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // Title — large, centred
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.xl),
                    child: Text(
                      title,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.headlineLarge?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        height: 1.1,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs + 2),

                  // Subtitle — centred, muted
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.xxl),
                    child: Text(
                      subtitle,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.68),
                        height: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),

                  // Gold accent line — centred decorative separator
                  Container(
                    width: 48,
                    height: 2,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [
                          Color(0x00B8941F),
                          AppPalette.gold400,
                          Color(0x00B8941F),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A premium glass back control — rounded-square pill with a white rim.
class _GlassBack extends StatelessWidget {
  const _GlassBack({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Material(
      color: Colors.white.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(AppRadii.md),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.md),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.30),
              width: 0.8,
            ),
          ),
          child: Icon(
            rtl ? Icons.chevron_right_rounded : Icons.chevron_left_rounded,
            color: Colors.white,
            size: 22,
          ),
        ),
      ),
    );
  }
}

/// Faint dotted overlay echoing the brand navy texture.
class _DotTexture extends StatelessWidget {
  const _DotTexture();
  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.045);
    const step = 24.0;
    for (var y = 8.0; y < size.height; y += step) {
      for (var x = 8.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form components
// ─────────────────────────────────────────────────────────────────────────────

/// Form group container — visually minimal, groups fields with generous spacing.
/// Each field brings its own elevation; this card adds no extra visual noise.
class AuthCard extends StatelessWidget {
  const AuthCard({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg + 2),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.xl),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );
  }
}

/// A labelled, icon-prefixed premium form field.
///
/// Label: small, uppercase, tracked, muted — feels like a luxury form.
/// Field: rounded 14px, generous padding, gold focus ring.
class AuthField extends StatelessWidget {
  const AuthField({
    super.key,
    required this.controller,
    required this.label,
    required this.icon,
    this.hint,
    this.validator,
    this.keyboardType,
    this.textInputAction,
    this.onFieldSubmitted,
    this.obscureText = false,
    this.suffix,
    this.enabled = true,
    this.errorText,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final String? hint;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onFieldSubmitted;
  final bool obscureText;
  final Widget? suffix;
  final bool enabled;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    OutlineInputBorder border(Color c, [double w = 0.8]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md + 2),
          borderSide: BorderSide(color: c, width: w),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Uppercase tracked label
        Text(
          label,
          style: theme.textTheme.labelSmall?.copyWith(
            color: colors.inkMuted,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.7,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          validator: validator,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          onFieldSubmitted: onFieldSubmitted,
          obscureText: obscureText,
          enabled: enabled,
          style: theme.textTheme.bodyLarge?.copyWith(
            color: colors.inkStrong,
            fontWeight: FontWeight.w500,
          ),
          decoration: InputDecoration(
            hintText: hint ?? label,
            errorText: errorText,
            filled: true,
            fillColor: enabled ? colors.surface : colors.surfaceSoft,
            prefixIcon: Icon(icon, size: 18, color: colors.inkMuted),
            suffixIcon: suffix,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md + 2,
            ),
            border: border(colors.hairline),
            enabledBorder: border(colors.hairline),
            focusedBorder: border(colors.brandGold, 1.8),
            errorBorder: border(colors.error),
            focusedErrorBorder: border(colors.error, 1.8),
            hintStyle: theme.textTheme.bodyLarge?.copyWith(
              color: colors.inkMuted.withValues(alpha: 0.6),
            ),
          ),
        ),
      ],
    );
  }
}

/// A password [AuthField] with a show/hide toggle.
class AuthPasswordField extends StatefulWidget {
  const AuthPasswordField({
    super.key,
    required this.controller,
    required this.label,
    this.validator,
    this.textInputAction,
    this.onFieldSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final String? Function(String?)? validator;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onFieldSubmitted;

  @override
  State<AuthPasswordField> createState() => _AuthPasswordFieldState();
}

class _AuthPasswordFieldState extends State<AuthPasswordField> {
  bool _obscured = true;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AuthField(
      controller: widget.controller,
      label: widget.label,
      icon: Icons.lock_outline_rounded,
      validator: widget.validator,
      textInputAction: widget.textInputAction,
      onFieldSubmitted: widget.onFieldSubmitted,
      obscureText: _obscured,
      suffix: IconButton(
        icon: Icon(
          _obscured
              ? Icons.visibility_outlined
              : Icons.visibility_off_outlined,
          size: 18,
          color: colors.inkMuted,
        ),
        onPressed: () => setState(() => _obscured = !_obscured),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer link
// ─────────────────────────────────────────────────────────────────────────────

/// A centred footer link: the full text is gold-weighted (primary action
/// phrasing) with a tiny gold spark accent preceding it.
class AuthFooterLink extends StatelessWidget {
  const AuthFooterLink({super.key, required this.text, required this.onTap});
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Center(
      child: TextButton(
        onPressed: onTap,
        style: TextButton.styleFrom(
          foregroundColor: colors.brandGold,
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 5,
              height: 5,
              decoration: BoxDecoration(
                color: colors.brandGold,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: colors.brandGold.withValues(alpha: 0.5),
                    blurRadius: 4,
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: colors.brandGold,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
