import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/create_broker_lead_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Create Broker Lead Screen
// ─────────────────────────────────────────────────────────────────────────────

class CreateBrokerLeadScreen extends StatelessWidget {
  const CreateBrokerLeadScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocConsumer<CreateBrokerLeadCubit, CreateBrokerLeadState>(
          listenWhen: (a, b) =>
              a.submitted != b.submitted ||
              a.submitFailure != b.submitFailure,
          listener: (context, state) {
            if (state.submitted) {
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(
                  SnackBar(content: Text(l10n.brokerLeadCreated)),
                );
              context.pop(true);
            } else if (state.submitFailure != null) {
              showFailureSnackBar(context, state.submitFailure!);
            }
          },
          builder: (context, state) {
            final cubit = context.read<CreateBrokerLeadCubit>();
            return Column(
              children: [
                const _FormHeader(),
                Expanded(
                  child: ListView(
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.lg,
                      AppSpacing.lg,
                      AppSpacing.lg,
                      AppSpacing.xl +
                          MediaQuery.of(context).padding.bottom,
                    ),
                    children: [
                      // ── Name ────────────────────────────────────────────
                      _SectionLabel(label: l10n.brokerLeadName),
                      const SizedBox(height: AppSpacing.sm),
                      _StyledTextField(
                        hint: l10n.brokerLeadName,
                        icon: Icons.person_rounded,
                        keyboardType: TextInputType.name,
                        onChanged: cubit.setFullName,
                        errorText: state.showValidation && !state.hasName
                            ? l10n.validationRequired
                            : null,
                      ),
                      const SizedBox(height: AppSpacing.md),

                      // ── Phone ───────────────────────────────────────────
                      _SectionLabel(label: l10n.brokerLeadPhone),
                      const SizedBox(height: AppSpacing.sm),
                      _StyledTextField(
                        hint: l10n.brokerLeadPhone,
                        icon: Icons.call_rounded,
                        keyboardType: TextInputType.phone,
                        onChanged: cubit.setPhone,
                        errorText: state.showValidation && !state.hasPhone
                            ? l10n.validationPhone
                            : null,
                      ),
                      const SizedBox(height: AppSpacing.md),

                      // ── Email ───────────────────────────────────────────
                      _SectionLabel(label: l10n.brokerLeadEmail),
                      const SizedBox(height: AppSpacing.sm),
                      _StyledTextField(
                        hint: l10n.brokerLeadEmail,
                        icon: Icons.email_rounded,
                        keyboardType: TextInputType.emailAddress,
                        onChanged: cubit.setEmail,
                      ),
                      const SizedBox(height: AppSpacing.md),

                      // ── Note ────────────────────────────────────────────
                      _SectionLabel(label: l10n.brokerLeadNote),
                      const SizedBox(height: AppSpacing.sm),
                      _StyledTextField(
                        hint: l10n.brokerLeadNote,
                        icon: Icons.sticky_note_2_rounded,
                        maxLines: 4,
                        onChanged: cubit.setNote,
                      ),
                      const SizedBox(height: AppSpacing.xl),

                      // ── Submit ──────────────────────────────────────────
                      AppButton(
                        label: l10n.brokerLeadSubmit,
                        icon: Icons.person_add_alt_1_rounded,
                        variant: AppButtonVariant.gold,
                        expand: true,
                        isLoading: state.submitting,
                        onPressed: state.submitting ? null : cubit.submit,
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ── Form header ───────────────────────────────────────────────────────────────

class _FormHeader extends StatelessWidget {
  const _FormHeader();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [_navyLight, _navyCard, _navyDeep],
          stops: [0.0, 0.45, 1.0],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x35000000),
            blurRadius: 22,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          const Positioned.fill(
            child: IgnorePointer(child: _DotTexture()),
          ),
          PositionedDirectional(
            end: 0,
            top: 0,
            child: Container(
              width: 160,
              height: 120,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.09),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 0,
            left: 48,
            right: 48,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.0),
                    AppPalette.gold400.withValues(alpha: 0.5),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              topInset + AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.xl,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _BackBtn(),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        l10n.brokerLeadNew,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'أضف بيانات العميل المحتمل',
                        style: TextStyle(
                          color: AppPalette.gold300,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppPalette.gold300.withValues(alpha: 0.35),
                    ),
                  ),
                  child: const Icon(
                    Icons.person_add_alt_1_rounded,
                    color: AppPalette.gold300,
                    size: 20,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Section label ─────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 3,
          height: 15,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppPalette.gold400, AppPalette.gold300],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: theme.textTheme.labelLarge?.copyWith(
            fontWeight: FontWeight.w700,
            color: colors.inkStrong,
          ),
        ),
      ],
    );
  }
}

// ── Styled text field ─────────────────────────────────────────────────────────

class _StyledTextField extends StatelessWidget {
  const _StyledTextField({
    required this.hint,
    required this.icon,
    required this.onChanged,
    this.keyboardType,
    this.maxLines = 1,
    this.errorText,
  });

  final String hint;
  final IconData icon;
  final ValueChanged<String> onChanged;
  final TextInputType? keyboardType;
  final int maxLines;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: errorText != null
                  ? colors.error.withValues(alpha: 0.5)
                  : colors.hairline.withValues(alpha: 0.6),
              width: errorText != null ? 1.5 : 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: EdgeInsets.only(
                  top: maxLines > 1 ? 14 : 0,
                  right: 0,
                  left: AppSpacing.md,
                ),
                child: Icon(
                  icon,
                  size: 18,
                  color: colors.inkMuted.withValues(alpha: 0.6),
                ),
              ),
              Expanded(
                child: TextField(
                  onChanged: onChanged,
                  keyboardType: keyboardType,
                  maxLines: maxLines,
                  decoration: InputDecoration(
                    hintText: hint,
                    hintStyle: TextStyle(
                      color: colors.inkMuted.withValues(alpha: 0.55),
                      fontSize: 14,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: 14,
                    ),
                    border: InputBorder.none,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (errorText != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Icon(
                Icons.error_outline_rounded,
                size: 12,
                color: colors.error,
              ),
              const SizedBox(width: 4),
              Text(
                errorText!,
                style: TextStyle(color: colors.error, fontSize: 11.5),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

// ── Shared ────────────────────────────────────────────────────────────────────

class _BackBtn extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.white,
          size: 16,
        ),
      ),
    );
  }
}

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
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
