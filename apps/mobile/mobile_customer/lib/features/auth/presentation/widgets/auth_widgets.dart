import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Premium navy hero header for the auth screens: gold eyebrow + brand, a large
/// white title and a muted subtitle, over the website navy depth gradient with a
/// soft gold glow and a faint dotted texture. Rounded bottom corners, with a
/// glass back control. RTL-safe + dark-mode safe.
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
    final radius = const BorderRadius.vertical(
      bottom: Radius.circular(AppRadii.xxl),
    );

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: context.appColors.shadowLift,
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: Stack(
          children: [
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment(0.64, -1.0),
                    radius: 1.5,
                    colors: [
                      Color(0xFF24426A),
                      Color(0xFF14273F),
                      Color(0xFF0B1726),
                    ],
                    stops: [0.0, 0.58, 1.0],
                  ),
                ),
              ),
            ),
            const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
            // Gold ambient glow in the start corner (RTL-aware).
            const Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: AlignmentDirectional(0.9, -0.5),
                      radius: 1.0,
                      colors: [Color(0x2BC8A24B), Color(0x00C8A24B)],
                      stops: [0.0, 0.6],
                    ),
                  ),
                ),
              ),
            ),
            SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.sm,
                  AppSpacing.lg,
                  AppSpacing.xl,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Back control.
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: _GlassBack(onTap: onBack ?? () {}),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    // Eyebrow.
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: AppPalette.gold400,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Text(
                          l10n.authEyebrow,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: AppPalette.gold300,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.4,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      title,
                      style: theme.textTheme.headlineMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        height: 1.1,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.78),
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A glass back control (RTL-aware chevron) for the navy header.
class _GlassBack extends StatelessWidget {
  const _GlassBack({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Material(
      color: Colors.white.withValues(alpha: 0.12),
      shape: CircleBorder(
        side: BorderSide(color: Colors.white.withValues(alpha: 0.35)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(
            rtl ? Icons.chevron_right_rounded : Icons.chevron_left_rounded,
            color: Colors.white,
            size: 24,
          ),
        ),
      ),
    );
  }
}

/// A faint dotted overlay echoing the brand navy texture.
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
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.05);
    const step = 22.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter oldDelegate) => false;
}

/// A labelled, icon-prefixed premium form field (rounded surface fill, hairline
/// border, gold focus ring) that still participates in [Form] validation.
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

  /// For non-Form fields (e.g. OTP) that manage their own error string.
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          borderSide: BorderSide(color: c, width: w),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.labelLarge?.copyWith(
            color: colors.inkStrong,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        TextFormField(
          controller: controller,
          validator: validator,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          onFieldSubmitted: onFieldSubmitted,
          obscureText: obscureText,
          enabled: enabled,
          style: theme.textTheme.bodyLarge?.copyWith(color: colors.inkStrong),
          decoration: InputDecoration(
            hintText: hint ?? label,
            errorText: errorText,
            filled: true,
            fillColor: enabled ? colors.surface : colors.surfaceSoft,
            prefixIcon: Icon(icon, size: 20, color: colors.inkMuted),
            suffixIcon: suffix,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
            border: border(colors.hairline),
            enabledBorder: border(colors.hairline),
            focusedBorder: border(colors.brandGold, 1.5),
            errorBorder: border(colors.error),
            focusedErrorBorder: border(colors.error, 1.5),
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
          size: 20,
          color: colors.inkMuted,
        ),
        onPressed: () => setState(() => _obscured = !_obscured),
      ),
    );
  }
}

/// The cream "form card" that floats below the navy header and groups the
/// fields with a soft shadow + hairline.
class AuthCard extends StatelessWidget {
  const AuthCard({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.xl),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.8)),
        boxShadow: colors.shadowSoft,
      ),
      child: child,
    );
  }
}

/// A centered footer link with a muted lead + gold action, e.g.
/// "Already have an account? Sign in".
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
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colors.brandGold,
                fontWeight: FontWeight.w700,
              ),
        ),
      ),
    );
  }
}
