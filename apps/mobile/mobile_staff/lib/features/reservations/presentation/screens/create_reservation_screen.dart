import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/create_reservation_cubit.dart';

class CreateReservationScreen extends StatefulWidget {
  const CreateReservationScreen({super.key});

  @override
  State<CreateReservationScreen> createState() => _CreateReservationScreenState();
}

class _CreateReservationScreenState extends State<CreateReservationScreen> {
  final _searchCtrl       = TextEditingController();
  final _notesCtrl        = TextEditingController();
  final _bookingNotesCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<CreateReservationCubit>().init();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _notesCtrl.dispose();
    _bookingNotesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: Column(
        children: [
          AppNavHeader(
            compact: true,
            title: l10n.reservationNew,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          Expanded(
            child: BlocConsumer<CreateReservationCubit, CreateReservationState>(
              listenWhen: (a, b) =>
                  a.submitted != b.submitted || a.submitFailure != b.submitFailure,
              listener: (context, state) {
                if (state.submitted) {
                  ScaffoldMessenger.of(context)
                    ..hideCurrentSnackBar()
                    ..showSnackBar(SnackBar(content: Text(l10n.reservationCreated)));
                  context.pop(true);
                } else if (state.submitFailure != null) {
                  showFailureSnackBar(context, state.submitFailure!);
                }
              },
              builder: (context, state) {
                final cubit = context.read<CreateReservationCubit>();
                final step2 = state.fixedUnit ? '01' : '02';
                final step3 = state.fixedUnit ? '02' : '03';
                final step4 = state.fixedUnit ? '03' : '04';

                return ListView(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg, AppSpacing.lg,
                    AppSpacing.lg, AppSpacing.xxl,
                  ),
                  children: [
                    // ── Section 01: Unit ──────────────────────────────────
                    if (!state.fixedUnit) ...[
                      _SectionCard(
                        step: '01',
                        title: l10n.reservationSectionUnit,
                        subtitle: l10n.reservationSectionUnitSubtitle,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _ProjectDropdown(state: state),
                            const SizedBox(height: AppSpacing.md),
                            _UnitDropdown(state: state),
                            if (state.showValidation && !state.hasUnit) ...[
                              const SizedBox(height: AppSpacing.xs),
                              _ValidationMsg(l10n.reservationUnitRequired),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],

                    // ── Section 02: Client ────────────────────────────────
                    _SectionCard(
                      step: step2,
                      title: l10n.reservationSectionClient,
                      subtitle: l10n.reservationSectionClientSubtitle,
                      child: _LeadPicker(
                        state: state,
                        searchCtrl: _searchCtrl,
                        onSearch: cubit.setLeadsSearch,
                        onSelect: cubit.selectLead,
                      ),
                    ),
                    if (state.showValidation && !state.hasLead) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm),
                        child: _ValidationMsg(l10n.reservationLeadRequired),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),

                    // ── Section 03: Details ───────────────────────────────
                    _SectionCard(
                      step: step3,
                      title: l10n.reservationSectionDetails,
                      subtitle: l10n.reservationSectionDetailsSubtitle,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _ExpiryDropdown(
                              state: state, onSelect: cubit.setExpiresInHours),
                          const SizedBox(height: AppSpacing.md),
                          AppTextField(
                            controller: _notesCtrl,
                            label: l10n.reservationNotesLabel,
                            maxLines: 3,
                            onChanged: cubit.setNotes,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),

                    // ── Section 04: Plan & Booking Amount ─────────────────
                    _SectionCard(
                      step: step4,
                      title: l10n.reservationSectionPlan,
                      subtitle: l10n.reservationSectionPlanSubtitle,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _PlanDropdown(
                              state: state, onSelect: cubit.selectPlan),
                          const SizedBox(height: AppSpacing.md),
                          _BookingAmountSection(state: state, cubit: cubit),
                          const SizedBox(height: AppSpacing.md),
                          AppTextField(
                            controller: _bookingNotesCtrl,
                            label: l10n.reservationBookingNotesLabel,
                            hint: l10n.reservationBookingNotesHint,
                            maxLines: 2,
                            onChanged: cubit.setBookingNotes,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),

                    // ── Submit ────────────────────────────────────────────
                    AppButton(
                      label: l10n.reservationCreate,
                      icon: Icons.bookmark_add_rounded,
                      variant: AppButtonVariant.gold,
                      size: AppButtonSize.large,
                      expand: true,
                      isLoading: state.submitting,
                      onPressed: state.submitting ? null : cubit.submit,
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Section card — identical design to create_lead_screen
// ═════════════════════════════════════════════════════════════════════════════

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.step,
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String step;
  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme  = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.xl),
        border: Border.all(color: colors.hairline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Gold shimmer top strip
          Container(
            height: 2,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Color(0x00B8941F),
                  AppPalette.gold400,
                  AppPalette.gold300,
                  Color(0x00B8941F),
                ],
              ),
              borderRadius:
                  BorderRadius.vertical(top: Radius.circular(AppRadii.xl)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header row: title + step badge
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: colors.inkStrong,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            subtitle,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: colors.inkMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [AppPalette.gold300, AppPalette.gold500],
                        ),
                        borderRadius: BorderRadius.circular(AppRadii.md),
                      ),
                      child: Center(
                        child: Text(
                          step,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                const Divider(height: 1),
                const SizedBox(height: AppSpacing.lg),
                child,
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Validation message
// ═════════════════════════════════════════════════════════════════════════════

class _ValidationMsg extends StatelessWidget {
  const _ValidationMsg(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: Theme.of(context)
            .textTheme
            .bodySmall
            ?.copyWith(color: context.appColors.error),
      );
}

// ═════════════════════════════════════════════════════════════════════════════
// Project dropdown
// ═════════════════════════════════════════════════════════════════════════════

class _ProjectDropdown extends StatelessWidget {
  const _ProjectDropdown({required this.state});
  final CreateReservationState state;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final lang   = Localizations.localeOf(context).languageCode;
    final cubit  = context.read<CreateReservationCubit>();
    final colors = context.appColors;

    if (state.projectsStatus == DataStatus.loading ||
        state.projectsStatus == DataStatus.initial) {
      return const _FieldLoader();
    }
    if (state.projectsStatus == DataStatus.failure) {
      return ErrorState(failure: state.projectsFailure, onRetry: cubit.init);
    }

    return _StyledDropdown<String>(
      hint: l10n.visitSelectProject,
      value: state.selectedProjectId,
      items: [
        for (final p in state.projects)
          DropdownMenuItem(value: p.id, child: Text(p.name.resolve(lang))),
      ],
      onChanged: (id) => id != null ? cubit.selectProject(id) : null,
      colors: colors,
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Unit dropdown
// ═════════════════════════════════════════════════════════════════════════════

class _UnitDropdown extends StatelessWidget {
  const _UnitDropdown({required this.state});
  final CreateReservationState state;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final cubit  = context.read<CreateReservationCubit>();
    final colors = context.appColors;

    if (state.selectedProjectId == null) {
      return Text(l10n.reservationPickProjectFirst,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: colors.inkMuted));
    }
    if (state.unitsStatus == DataStatus.loading) {
      return const _FieldLoader();
    }

    final available = state.units.where((u) => u.status == 'AVAILABLE').toList();
    if (available.isEmpty) {
      return Text(l10n.unitsEmptyMessage,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: colors.inkMuted));
    }

    return _StyledDropdown<String>(
      hint: l10n.reservationSelectUnit,
      value: state.selectedUnitId,
      items: [
        for (final u in available)
          DropdownMenuItem(
            value: u.id,
            child: Text('${u.code}${u.type != null ? ' · ${u.type}' : ''}'),
          ),
      ],
      onChanged: (id) => id != null ? cubit.selectUnit(id) : null,
      colors: colors,
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Lead picker — search field + result tiles + selected card
// ═════════════════════════════════════════════════════════════════════════════

class _LeadPicker extends StatelessWidget {
  const _LeadPicker({
    required this.state,
    required this.searchCtrl,
    required this.onSearch,
    required this.onSelect,
  });

  final CreateReservationState state;
  final TextEditingController searchCtrl;
  final ValueChanged<String> onSearch;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);

    // Selected state — show card
    if (state.selectedLeadId != null) {
      final lead = state.leads.firstWhere(
        (l) => l.id == state.selectedLeadId,
        orElse: () => state.leads.first,
      );
      return _SelectedLeadCard(
        lead: lead,
        colors: colors,
        theme: theme,
        onClear: () {
          searchCtrl.clear();
          onSearch('');
          onSelect(null);
        },
      );
    }

    if (state.leadsStatus == DataStatus.loading ||
        state.leadsStatus == DataStatus.initial) {
      return const _FieldLoader();
    }

    final filtered = state.filteredLeads;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Search field — same style as create_lead_screen
        TextField(
          controller: searchCtrl,
          onChanged: onSearch,
          textInputAction: TextInputAction.search,
          style: const TextStyle(fontSize: 14),
          decoration: InputDecoration(
            hintText: l10n.reservationLeadSearch,
            prefixIcon:
                Icon(Icons.search_rounded, size: 20, color: colors.inkMuted),
            filled: true,
            fillColor: colors.surfaceSoft,
            contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: 13),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.md),
              borderSide: BorderSide(color: colors.hairline),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.md),
              borderSide: BorderSide(color: colors.hairline),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.md),
              borderSide:
                  const BorderSide(color: AppPalette.gold400, width: 1.5),
            ),
            suffixIcon: searchCtrl.text.isNotEmpty
                ? IconButton(
                    icon: Icon(Icons.clear_rounded,
                        size: 18, color: colors.inkMuted),
                    onPressed: () {
                      searchCtrl.clear();
                      onSearch('');
                    },
                  )
                : null,
          ),
        ),
        // Result tiles
        if (filtered.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          ...filtered.take(6).map((lead) => _LeadResultTile(
                lead: lead,
                colors: colors,
                theme: theme,
                onTap: () => onSelect(lead.id),
              )),
        ] else if (searchCtrl.text.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Center(
            child: Text(
              l10n.leadSearchEmpty,
              style: TextStyle(color: colors.inkMuted, fontSize: 13),
            ),
          ),
        ] else ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.reservationLeadSelect,
            style: TextStyle(color: colors.inkMuted, fontSize: 13),
          ),
        ],
      ],
    );
  }
}

class _LeadResultTile extends StatelessWidget {
  const _LeadResultTile({
    required this.lead,
    required this.colors,
    required this.theme,
    required this.onTap,
  });

  final dynamic lead;
  final AppColorsExt colors;
  final ThemeData theme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name    = lead.fullName as String;
    final phone   = lead.phone as String?;
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppPalette.gold400, AppPalette.gold600],
                  ),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Center(
                  child: Text(
                    initial,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: colors.inkStrong,
                        )),
                    if (phone != null)
                      Text(phone,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: colors.inkMuted)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded,
                  size: 18, color: colors.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _SelectedLeadCard extends StatelessWidget {
  const _SelectedLeadCard({
    required this.lead,
    required this.colors,
    required this.theme,
    required this.onClear,
  });

  final dynamic lead;
  final AppColorsExt colors;
  final ThemeData theme;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final name  = lead.fullName as String;
    final phone = lead.phone as String?;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppPalette.gold400.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppPalette.gold400.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppPalette.gold300, AppPalette.gold500],
              ),
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Center(
              child: Text(
                name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: colors.inkStrong,
                    )),
                if (phone != null)
                  Text(phone,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: colors.inkMuted)),
              ],
            ),
          ),
          TextButton(
            onPressed: onClear,
            style: TextButton.styleFrom(
              foregroundColor: AppPalette.gold600,
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm, vertical: 4),
            ),
            child: Text(
              context.l10n.leadChangeClient,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Expiry hours dropdown
// ═════════════════════════════════════════════════════════════════════════════

class _ExpiryDropdown extends StatelessWidget {
  const _ExpiryDropdown({required this.state, required this.onSelect});
  final CreateReservationState state;
  final ValueChanged<int> onSelect;

  static const _options = [24, 48, 72, 120, 168, 336];

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final labels = {
      24: l10n.reservationExpiry24,
      48: l10n.reservationExpiry48,
      72: l10n.reservationExpiry72,
      120: l10n.reservationExpiry120,
      168: l10n.reservationExpiry168,
      336: l10n.reservationExpiry336,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.reservationExpiryLabel,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: colors.inkMuted)),
        const SizedBox(height: AppSpacing.xs),
        _StyledDropdown<int>(
          hint: '',
          value: state.expiresInHours,
          items: [
            for (final h in _options)
              DropdownMenuItem(value: h, child: Text(labels[h] ?? '$h h')),
          ],
          onChanged: (v) => v != null ? onSelect(v) : null,
          colors: colors,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(l10n.reservationExpiryHint,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: colors.inkMuted, fontSize: 11)),
      ],
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Plan dropdown
// ═════════════════════════════════════════════════════════════════════════════

class _PlanDropdown extends StatelessWidget {
  const _PlanDropdown({required this.state, required this.onSelect});
  final CreateReservationState state;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;

    final noUnit = (state.selectedProjectId == null) && !state.fixedUnit;
    if (noUnit) {
      return Text(l10n.reservationPlanNoUnit,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: colors.inkMuted));
    }
    if (state.plansStatus == DataStatus.loading) {
      return const _FieldLoader();
    }

    final plans = state.plans;
    if (plans.isEmpty) {
      return Text(l10n.reservationPlanNoUnit,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: colors.inkMuted));
    }

    return _StyledDropdown<String?>(
      hint: l10n.reservationPlanOptional,
      value: state.selectedPlanId,
      items: [
        DropdownMenuItem<String?>(
            value: null, child: Text(l10n.reservationPlanOptional)),
        for (final p in plans)
          DropdownMenuItem<String?>(value: p.id, child: Text(p.name)),
      ],
      onChanged: onSelect,
      colors: colors,
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Booking amount method (Plan / Fixed / Percentage)
// ═════════════════════════════════════════════════════════════════════════════

class _BookingAmountSection extends StatefulWidget {
  const _BookingAmountSection({required this.state, required this.cubit});
  final CreateReservationState state;
  final CreateReservationCubit cubit;

  @override
  State<_BookingAmountSection> createState() => _BookingAmountSectionState();
}

class _BookingAmountSectionState extends State<_BookingAmountSection> {
  final _fixedCtrl = TextEditingController();
  final _pctCtrl   = TextEditingController();

  @override
  void dispose() {
    _fixedCtrl.dispose();
    _pctCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);
    final mode   = widget.state.bookingAmountMode;

    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: colors.hairline),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.reservationBookingAmountTitle,
              style: theme.textTheme.titleSmall?.copyWith(
                color: colors.inkStrong,
                fontWeight: FontWeight.w700,
              )),
          const SizedBox(height: 4),
          Text(l10n.reservationBookingAmountDesc,
              style: theme.textTheme.bodySmall?.copyWith(
                color: colors.inkMuted,
                fontSize: 11,
              )),
          const SizedBox(height: AppSpacing.md),
          // Radio row
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.xs,
            children: [
              _ModeChip(
                label: l10n.reservationBookingModePlan,
                value: 'PLAN',
                groupValue: mode,
                onTap: widget.cubit.setBookingAmountMode,
                colors: colors,
              ),
              _ModeChip(
                label: l10n.reservationBookingModeFixed,
                value: 'FIXED',
                groupValue: mode,
                onTap: widget.cubit.setBookingAmountMode,
                colors: colors,
              ),
              _ModeChip(
                label: l10n.reservationBookingModePercent,
                value: 'PERCENTAGE',
                groupValue: mode,
                onTap: widget.cubit.setBookingAmountMode,
                colors: colors,
              ),
            ],
          ),
          if (mode == 'FIXED') ...[
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _fixedCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              onChanged: widget.cubit.setBookingAmount,
              decoration: InputDecoration(
                isDense: true,
                labelText: l10n.reservationBookingFixedLabel,
                hintText: l10n.reservationBookingFixedHint,
              ),
            ),
          ],
          if (mode == 'PERCENTAGE') ...[
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _pctCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              onChanged: widget.cubit.setBookingAmountPercent,
              decoration: InputDecoration(
                isDense: true,
                labelText: l10n.reservationBookingPercentLabel,
                hintText: l10n.reservationBookingPercentHint,
                suffixText: '%',
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({
    required this.label,
    required this.value,
    required this.groupValue,
    required this.onTap,
    required this.colors,
  });

  final String label;
  final String value;
  final String groupValue;
  final ValueChanged<String> onTap;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    final selected = value == groupValue;
    return GestureDetector(
      onTap: () => onTap(value),
      behavior: HitTestBehavior.opaque,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 18,
            height: 18,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: selected ? AppPalette.gold400 : colors.inkMuted,
                width: selected ? 2 : 1.5,
              ),
            ),
            alignment: Alignment.center,
            child: selected
                ? Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppPalette.gold400,
                      shape: BoxShape.circle,
                    ),
                  )
                : null,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight:
                      selected ? FontWeight.w600 : FontWeight.normal,
                  color: selected ? colors.inkStrong : colors.inkMuted,
                ),
          ),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Shared styled dropdown — same surfaceSoft + hairline look as lead screen
// ═════════════════════════════════════════════════════════════════════════════

class _StyledDropdown<T> extends StatelessWidget {
  const _StyledDropdown({
    required this.hint,
    required this.value,
    required this.items,
    required this.onChanged,
    required this.colors,
  });

  final String hint;
  final T? value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: colors.hairline),
      ),
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: 4),
      child: DropdownButton<T>(
        value: value,
        isExpanded: true,
        underline: const SizedBox.shrink(),
        hint: Text(hint,
            style: TextStyle(color: colors.inkMuted, fontSize: 14)),
        items: items,
        onChanged: onChanged,
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Tiny loading placeholder
// ═════════════════════════════════════════════════════════════════════════════

class _FieldLoader extends StatelessWidget {
  const _FieldLoader();

  @override
  Widget build(BuildContext context) => const SizedBox(
        height: 48,
        child: Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
                strokeWidth: 2, color: AppPalette.gold400),
          ),
        ),
      );
}
