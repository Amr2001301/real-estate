import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/create_broker_lead_cubit.dart';


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
              a.submitted != b.submitted || a.submitFailure != b.submitFailure,
          listener: (context, state) {
            if (state.submitted) {
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(SnackBar(content: Text(l10n.brokerLeadCreated)));
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
                      AppSpacing.xl + MediaQuery.of(context).padding.bottom,
                    ),
                    children: [
                      // ── Contact info card ────────────────────────────────
                      _GroupCard(
                        children: [
                          _FieldRow(
                            icon: Icons.person_rounded,
                            label: l10n.brokerLeadName,
                            hint: l10n.brokerLeadName,
                            keyboardType: TextInputType.name,
                            required: true,
                            errorText: state.showValidation && !state.hasName
                                ? l10n.validationRequired
                                : null,
                            onChanged: cubit.setFullName,
                          ),
                          _Divider(),
                          _FieldRow(
                            icon: Icons.call_rounded,
                            label: l10n.brokerLeadPhone,
                            hint: l10n.brokerLeadPhone,
                            keyboardType: TextInputType.phone,
                            required: true,
                            errorText: state.showValidation && !state.hasPhone
                                ? l10n.validationPhone
                                : null,
                            onChanged: cubit.setPhone,
                          ),
                          _Divider(),
                          _FieldRow(
                            icon: Icons.email_rounded,
                            label: l10n.brokerLeadEmail,
                            hint: l10n.brokerLeadEmail,
                            keyboardType: TextInputType.emailAddress,
                            onChanged: cubit.setEmail,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),

                      // ── Note card ────────────────────────────────────────
                      _NoteCard(
                        label: l10n.brokerLeadNote,
                        hint: l10n.brokerLeadNote,
                        onChanged: cubit.setNote,
                      ),
                      const SizedBox(height: AppSpacing.xl),

                      // ── Submit ───────────────────────────────────────────
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
    return AppNavHeader(
      title: l10n.brokerLeadNew,
      subtitle: 'أضف بيانات العميل المحتمل',
      compact: true,
      leadingAction: const NavHeaderBack(),
    );
  }
}

// ── Grouped field card ────────────────────────────────────────────────────────

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.card,
        border: Border.all(color: colors.hairline, width: 0.8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: children),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      height: 0.5,
      margin: const EdgeInsetsDirectional.only(start: 52),
      color: colors.hairline,
    );
  }
}

// ── Field row (inside grouped card) ──────────────────────────────────────────

class _FieldRow extends StatefulWidget {
  const _FieldRow({
    required this.icon,
    required this.label,
    required this.hint,
    required this.onChanged,
    this.keyboardType,
    this.required = false,
    this.errorText,
  });

  final IconData icon;
  final String label;
  final String hint;
  final ValueChanged<String> onChanged;
  final TextInputType? keyboardType;
  final bool required;
  final String? errorText;

  @override
  State<_FieldRow> createState() => _FieldRowState();
}

class _FieldRowState extends State<_FieldRow> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final hasError = widget.errorText != null;

    final iconColor = hasError
        ? colors.error
        : _focused
        ? AppPalette.gold400
        : colors.inkMuted;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      decoration: BoxDecoration(
        color: _focused
            ? AppPalette.gold400.withValues(alpha: 0.03)
            : Colors.transparent,
        borderRadius: AppRadii.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              0,
            ),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.10),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(widget.icon, size: 15, color: iconColor),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  widget.label,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: hasError ? colors.error : colors.inkMuted,
                    fontWeight: FontWeight.w600,
                    fontSize: 11.5,
                  ),
                ),
                if (widget.required) ...[
                  const SizedBox(width: 4),
                  Text(
                    '*',
                    style: TextStyle(
                      color: colors.error,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Focus(
            onFocusChange: (v) => setState(() => _focused = v),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                52,
                4,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: TextField(
                onChanged: widget.onChanged,
                keyboardType: widget.keyboardType,
                textDirection: widget.keyboardType == TextInputType.phone ? TextDirection.ltr : null,
                textAlign: widget.keyboardType == TextInputType.phone && Directionality.of(context) == TextDirection.rtl
                    ? TextAlign.right
                    : TextAlign.start,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w500,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                  hintText: widget.hint,
                  hintStyle: theme.textTheme.bodyMedium?.copyWith(
                    color: colors.inkMuted.withValues(alpha: 0.5),
                  ),
                ),
              ),
            ),
          ),
          if (hasError)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                52,
                0,
                AppSpacing.md,
                AppSpacing.xs,
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.error_outline_rounded,
                    size: 11,
                    color: colors.error,
                  ),
                  const SizedBox(width: 3),
                  Text(
                    widget.errorText!,
                    style: TextStyle(
                      color: colors.error,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
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

// ── Note card ─────────────────────────────────────────────────────────────────

class _NoteCard extends StatefulWidget {
  const _NoteCard({
    required this.label,
    required this.hint,
    required this.onChanged,
  });
  final String label;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  State<_NoteCard> createState() => _NoteCardState();
}

class _NoteCardState extends State<_NoteCard> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final iconColor = _focused ? AppPalette.gold400 : colors.inkMuted;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.card,
        border: Border.all(
          color: _focused
              ? AppPalette.gold400.withValues(alpha: 0.40)
              : colors.hairline,
          width: _focused ? 1.2 : 0.8,
        ),
        boxShadow: [
          if (_focused)
            BoxShadow(
              color: AppPalette.gold400.withValues(alpha: 0.08),
              blurRadius: 14,
              offset: const Offset(0, 4),
            ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.10),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.sticky_note_2_rounded,
                    size: 15,
                    color: iconColor,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  widget.label,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: colors.inkMuted,
                    fontWeight: FontWeight.w600,
                    fontSize: 11.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Focus(
              onFocusChange: (v) => setState(() => _focused = v),
              child: TextField(
                onChanged: widget.onChanged,
                maxLines: 4,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colors.inkStrong,
                  fontWeight: FontWeight.w500,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: const EdgeInsetsDirectional.only(start: 4),
                  hintText: widget.hint,
                  hintStyle: theme.textTheme.bodyMedium?.copyWith(
                    color: colors.inkMuted.withValues(alpha: 0.5),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Shared ────────────────────────────────────────────────────────────────────

