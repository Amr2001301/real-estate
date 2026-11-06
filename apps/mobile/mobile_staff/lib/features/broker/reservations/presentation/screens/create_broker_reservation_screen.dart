import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/create_broker_reservation_cubit.dart';


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
                      // ── Client (when not fixed) ──────────────────────────
                      if (!state.fixedLead) ...[
                        AppFormSection(
                          step: '01',
                          title: l10n.reservationSectionClient,
                          subtitle: l10n.brokerReservationClientSubtitle,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
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
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                      ],

                      // ── Unit ──────────────────────────────────────────────
                      AppFormSection(
                        step: state.fixedLead ? '01' : '02',
                        title: l10n.reservationSectionUnit,
                        subtitle: l10n.reservationSectionUnitSubtitle,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
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
                            _SectionLabel(label: l10n.reservationUnit),
                            const SizedBox(height: AppSpacing.sm),
                            _UnitPicker(state: state),
                            if (state.showValidation && !state.hasUnit) ...[
                              const SizedBox(height: AppSpacing.xs),
                              _ErrorText(l10n.reservationUnitRequired),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),

                      // ── Note ──────────────────────────────────────────────
                      AppFormSection(
                        step: state.fixedLead ? '02' : '03',
                        title: l10n.leadNotes,
                        subtitle: l10n.brokerSectionNoteSubtitle,
                        child: AppTextField(
                          hint: l10n.leadNotesHint,
                          maxLines: 4,
                          onChanged: cubit.setNotes,
                        ),
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
    return HomeListHero(back: true, title: l10n.reservationNew, subtitle: l10n.brokerReservationNewSubtitle);
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
            child: Text('${u.code}${u.type != null ? ' · ${unitTypeLabel(u.type, languageCode: Localizations.localeOf(context).languageCode)}' : ''}'),
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
        // The container draws the field; switch off the theme's own border
        // and fill so the field doesn't show a second box inside it.
        decoration: const InputDecoration(
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          filled: false,
          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        ),
        items: items,
        onChanged: onChanged,
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
          style: TextStyle(color: context.appColors.error, fontSize: 12),
        ),
      ],
    );
  }
}

// ── Shared ────────────────────────────────────────────────────────────────────

