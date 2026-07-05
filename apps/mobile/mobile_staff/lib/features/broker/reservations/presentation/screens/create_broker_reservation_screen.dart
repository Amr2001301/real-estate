import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/create_broker_reservation_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Create Broker Reservation Screen
// ─────────────────────────────────────────────────────────────────────────────

class CreateBrokerReservationScreen extends StatelessWidget {
  const CreateBrokerReservationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: BlocConsumer<CreateBrokerReservationCubit,
            CreateBrokerReservationState>(
          listenWhen: (a, b) =>
              a.submitted != b.submitted ||
              a.submitFailure != b.submitFailure,
          listener: (context, state) {
            if (state.submitted) {
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(
                  SnackBar(content: Text(l10n.reservationCreated)),
                );
              context.pop(true);
            } else if (state.submitFailure != null) {
              showFailureSnackBar(context, state.submitFailure!);
            }
          },
          builder: (context, state) {
            final cubit = context.read<CreateBrokerReservationCubit>();
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
                      // ── Lead picker (when not fixed) ─────────────────────
                      if (!state.fixedLead) ...[
                        _SectionLabel(label: l10n.navLeads),
                        const SizedBox(height: AppSpacing.sm),
                        _StyledDropdown<String>(
                          hint: l10n.brokerSelectLead,
                          icon: Icons.person_rounded,
                          value: state.selectedLeadId,
                          items: [
                            for (final lead in state.leads)
                              DropdownMenuItem(
                                value: lead.id,
                                child: Text(lead.fullName),
                              ),
                          ],
                          onChanged: (id) =>
                              id != null ? cubit.selectLead(id) : null,
                        ),
                        if (state.showValidation && !state.hasLead) ...[
                          const SizedBox(height: AppSpacing.xs),
                          _ErrorText(l10n.brokerSelectLead),
                        ],
                        const SizedBox(height: AppSpacing.md),
                      ],

                      // ── Project picker ────────────────────────────────────
                      _SectionLabel(label: l10n.visitProject),
                      const SizedBox(height: AppSpacing.sm),
                      _StyledDropdown<String>(
                        hint: l10n.visitSelectProject,
                        icon: Icons.apartment_rounded,
                        value: state.selectedProjectId,
                        items: [
                          for (final p in state.projects)
                            DropdownMenuItem(
                              value: p.id,
                              child: Text(p.name.resolve(lang)),
                            ),
                        ],
                        onChanged: (id) =>
                            id != null ? cubit.selectProject(id) : null,
                      ),
                      const SizedBox(height: AppSpacing.md),

                      // ── Unit picker ───────────────────────────────────────
                      _SectionLabel(label: l10n.reservationUnit),
                      const SizedBox(height: AppSpacing.sm),
                      _UnitPicker(state: state),
                      if (state.showValidation && !state.hasUnit) ...[
                        const SizedBox(height: AppSpacing.xs),
                        _ErrorText(l10n.reservationUnitRequired),
                      ],
                      const SizedBox(height: AppSpacing.md),

                      // ── Note ──────────────────────────────────────────────
                      _SectionLabel(label: l10n.brokerLeadNote),
                      const SizedBox(height: AppSpacing.sm),
                      _StyledNoteField(
                        hint: l10n.brokerLeadNote,
                        onChanged: cubit.setNotes,
                      ),
                      const SizedBox(height: AppSpacing.xl),

                      // ── Submit ────────────────────────────────────────────
                      AppButton(
                        label: l10n.reservationCreate,
                        icon: Icons.bookmark_add_rounded,
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
                        l10n.reservationNew,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'قدّم طلب حجز وحدة للعميل',
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
                    Icons.bookmark_add_rounded,
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

// ── Unit picker ───────────────────────────────────────────────────────────────

class _UnitPicker extends StatelessWidget {
  const _UnitPicker({required this.state});
  final CreateBrokerReservationState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<CreateBrokerReservationCubit>();
    final colors = context.appColors;

    if (state.selectedProjectId == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
        ),
        child: Row(
          children: [
            Icon(
              Icons.home_work_rounded,
              size: 18,
              color: colors.inkMuted.withValues(alpha: 0.4),
            ),
            const SizedBox(width: 10),
            Text(
              l10n.reservationPickProjectFirst,
              style: TextStyle(
                color: colors.inkMuted.withValues(alpha: 0.6),
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }

    if (state.unitsStatus == DataStatus.loading) {
      return Container(
        height: 52,
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
        ),
        child: const Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    if (state.unitsStatus == DataStatus.empty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
        ),
        child: Text(
          l10n.unitsEmptyMessage,
          style: TextStyle(color: colors.inkMuted, fontSize: 14),
        ),
      );
    }

    return _StyledDropdown<String>(
      hint: l10n.reservationSelectUnit,
      icon: Icons.home_work_rounded,
      value: state.selectedUnitId,
      items: [
        for (final u in state.units)
          DropdownMenuItem(
            value: u.id,
            child: Text('${u.code}${u.type != null ? ' · ${u.type}' : ''}'),
          ),
      ],
      onChanged: (id) => id != null ? cubit.selectUnit(id) : null,
    );
  }
}

// ── Styled dropdown ───────────────────────────────────────────────────────────

class _StyledDropdown<T> extends StatelessWidget {
  const _StyledDropdown({
    required this.hint,
    required this.icon,
    required this.items,
    required this.onChanged,
    this.value,
  });

  final String hint;
  final IconData icon;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: DropdownButtonFormField<T>(
        initialValue: value,
        isExpanded: true,
        hint: Row(
          children: [
            Icon(icon, size: 17, color: colors.inkMuted.withValues(alpha: 0.5)),
            const SizedBox(width: 10),
            Text(
              hint,
              style: TextStyle(
                color: colors.inkMuted.withValues(alpha: 0.6),
                fontSize: 14,
              ),
            ),
          ],
        ),
        decoration: const InputDecoration(
          border: InputBorder.none,
          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        ),
        items: items,
        onChanged: onChanged,
      ),
    );
  }
}

// ── Styled note field ─────────────────────────────────────────────────────────

class _StyledNoteField extends StatelessWidget {
  const _StyledNoteField({
    required this.hint,
    required this.onChanged,
  });

  final String hint;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TextField(
        onChanged: onChanged,
        maxLines: 4,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(
            color: colors.inkMuted.withValues(alpha: 0.55),
            fontSize: 14,
          ),
          contentPadding: const EdgeInsets.all(AppSpacing.md),
          border: InputBorder.none,
        ),
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

// ── Error text ────────────────────────────────────────────────────────────────

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(Icons.error_outline_rounded, size: 12, color: context.appColors.error),
        const SizedBox(width: 4),
        Text(
          text,
          style: TextStyle(color: context.appColors.error, fontSize: 11.5),
        ),
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
        child: Icon(
          Directionality.of(context) == TextDirection.rtl
              ? Icons.arrow_forward_ios_rounded
              : Icons.arrow_back_ios_new_rounded,
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
