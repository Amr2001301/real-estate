import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../clients/domain/entities/staff_client.dart';
import '../cubit/create_visit_cubit.dart';

/// "Schedule visit" form — mirrors the dashboard's 3-section create-visit flow:
///   01 العميل   02 المشروع والوحدة   03 موعد الزيارة والملاحظات
class CreateVisitScreen extends StatefulWidget {
  const CreateVisitScreen({super.key});

  @override
  State<CreateVisitScreen> createState() => _CreateVisitScreenState();
}

class _CreateVisitScreenState extends State<CreateVisitScreen> {
  final _searchCtrl       = TextEditingController(); // lead search
  final _clientSearchCtrl = TextEditingController(); // registered client search
  final _walkInNameCtrl   = TextEditingController();
  final _walkInPhoneCtrl  = TextEditingController();
  final _locationCtrl     = TextEditingController();
  final _notesCtrl        = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<CreateVisitCubit>().init();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _clientSearchCtrl.dispose();
    _walkInNameCtrl.dispose();
    _walkInPhoneCtrl.dispose();
    _locationCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDateTime() async {
    final cubit = context.read<CreateVisitCubit>();
    final now   = DateTime.now();
    final date  = await showDatePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      initialDate: now,
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.now());
    if (time == null) return;
    cubit.setSchedule(DateTime(date.year, date.month, date.day, time.hour, time.minute));
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
            title: l10n.visitNew,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          Expanded(
            child: BlocConsumer<CreateVisitCubit, CreateVisitState>(
              listenWhen: (a, b) =>
                  a.submitted != b.submitted || a.submitFailure != b.submitFailure,
              listener: (context, state) {
                if (state.submitted) {
                  ScaffoldMessenger.of(context)
                    ..hideCurrentSnackBar()
                    ..showSnackBar(SnackBar(content: Text(l10n.visitCreated)));
                  context.pop(true);
                } else if (state.submitFailure != null) {
                  showFailureSnackBar(context, state.submitFailure!);
                }
              },
              builder: (context, state) {
                final cubit = context.read<CreateVisitCubit>();
                final lang  = Localizations.localeOf(context).languageCode;

                return ListView(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg, AppSpacing.lg,
                    AppSpacing.lg, AppSpacing.xxl,
                  ),
                  children: [
                    // ── Section 01: Client ──────────────────────────────────
                    _SectionCard(
                      step: '01',
                      title: l10n.visitSectionClient,
                      subtitle: l10n.visitSectionClientSubtitle,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Client type toggle (3 options)
                          _ClientTypeToggle(
                            value: state.clientType,
                            onChanged: cubit.setClientType,
                          ),
                          // ── CRM Lead picker
                          if (state.clientType == VisitClientType.lead) ...[
                            const SizedBox(height: AppSpacing.md),
                            _LeadPicker(
                              state: state,
                              searchCtrl: _searchCtrl,
                              onSearch: cubit.setLeadsSearch,
                              onSelect: cubit.selectLead,
                            ),
                            if (state.showValidation && !state.hasClient) ...[
                              const SizedBox(height: AppSpacing.xs),
                              _ValidationMsg(l10n.visitLeadRequired),
                            ],
                          ],
                          // ── Registered client picker
                          if (state.clientType == VisitClientType.registered) ...[
                            const SizedBox(height: AppSpacing.md),
                            _ClientPicker(
                              state: state,
                              searchCtrl: _clientSearchCtrl,
                              onSearch: cubit.setClientsSearch,
                              onSelect: cubit.selectClient,
                            ),
                            if (state.showValidation && !state.hasClient) ...[
                              const SizedBox(height: AppSpacing.xs),
                              _ValidationMsg(l10n.visitClientRequired),
                            ],
                          ],
                          // ── Walk-in form (name + phone)
                          if (state.clientType == VisitClientType.walkin) ...[
                            const SizedBox(height: AppSpacing.md),
                            _WalkInForm(
                              nameCtrl: _walkInNameCtrl,
                              phoneCtrl: _walkInPhoneCtrl,
                              onNameChanged: cubit.setWalkInName,
                              onPhoneChanged: cubit.setWalkInPhone,
                              showValidation: state.showValidation,
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),

                    // ── Section 02: Project & Unit ──────────────────────────
                    if (!state.fixedProject) ...[
                      _SectionCard(
                        step: '02',
                        title: l10n.visitSectionProject,
                        subtitle: l10n.visitSectionProjectSubtitle,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _ProjectDropdown(state: state),
                            if (state.showValidation && !state.hasProject) ...[
                              const SizedBox(height: AppSpacing.xs),
                              _ValidationMsg(l10n.visitProjectRequired),
                            ],
                            // Unit picker appears after project is chosen
                            if (state.selectedProjectId != null) ...[
                              const SizedBox(height: AppSpacing.md),
                              _UnitDropdown(state: state),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],

                    // ── Section 03: Schedule & Notes ────────────────────────
                    _SectionCard(
                      step: state.fixedProject ? '02' : '03',
                      title: l10n.visitSectionSchedule,
                      subtitle: l10n.visitSectionScheduleSubtitle,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Date/time picker tile
                          _DateTimeTile(
                            scheduledAt: state.scheduledAt,
                            lang: lang,
                            onTap: _pickDateTime,
                          ),
                          if (state.showValidation && !state.hasSchedule) ...[
                            const SizedBox(height: AppSpacing.xs),
                            _ValidationMsg(l10n.visitScheduleRequired),
                          ],
                          const SizedBox(height: AppSpacing.md),
                          AppTextField(
                            controller: _locationCtrl,
                            label: l10n.visitLocation,
                            onChanged: cubit.setLocation,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          AppTextField(
                            controller: _notesCtrl,
                            label: l10n.visitNotes,
                            maxLines: 3,
                            onChanged: cubit.setNotes,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),

                    // ── Submit ──────────────────────────────────────────────
                    AppButton(
                      label: l10n.visitCreate,
                      icon: Icons.event_available_rounded,
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
// Section card — same design as create_reservation_screen
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
              borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.xl)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title,
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: colors.inkStrong,
                              )),
                          const SizedBox(height: 2),
                          Text(subtitle,
                              style: theme.textTheme.bodySmall
                                  ?.copyWith(color: colors.inkMuted)),
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
                        child: Text(step,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            )),
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
// Client type segmented control — 3 tabs in one row
// ═════════════════════════════════════════════════════════════════════════════

class _ClientTypeToggle extends StatelessWidget {
  const _ClientTypeToggle({required this.value, required this.onChanged});
  final VisitClientType value;
  final ValueChanged<VisitClientType> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.hairline),
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: _Segment(
                icon: Icons.person_search_rounded,
                label: l10n.visitClientTypeLead,
                selected: value == VisitClientType.lead,
                onTap: () => onChanged(VisitClientType.lead),
                colors: colors,
              ),
            ),
            Container(width: 1, color: colors.hairline),
            Expanded(
              child: _Segment(
                icon: Icons.account_circle_rounded,
                label: l10n.visitClientTypeRegistered,
                selected: value == VisitClientType.registered,
                onTap: () => onChanged(VisitClientType.registered),
                colors: colors,
              ),
            ),
            Container(width: 1, color: colors.hairline),
            Expanded(
              child: _Segment(
                icon: Icons.directions_walk_rounded,
                label: l10n.visitClientTypeWalkin,
                selected: value == VisitClientType.walkin,
                onTap: () => onChanged(VisitClientType.walkin),
                colors: colors,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    required this.colors,
  });
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 11),
        color: selected
            ? AppPalette.gold400.withValues(alpha: 0.11)
            : Colors.transparent,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: selected
                    ? AppPalette.gold400.withValues(alpha: 0.15)
                    : colors.surface.withValues(alpha: 0.0),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 17,
                color: selected ? AppPalette.gold600 : colors.inkMuted,
              ),
            ),
            const SizedBox(height: 5),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11,
                  height: 1.25,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? AppPalette.gold600 : colors.inkMuted,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Lead picker — search + result tiles + selected card
// ═════════════════════════════════════════════════════════════════════════════

class _LeadPicker extends StatelessWidget {
  const _LeadPicker({
    required this.state,
    required this.searchCtrl,
    required this.onSearch,
    required this.onSelect,
  });
  final CreateVisitState state;
  final TextEditingController searchCtrl;
  final ValueChanged<String> onSearch;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);

    // Selected lead — show card
    if (state.selectedLeadId != null && state.leads.isNotEmpty) {
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
        TextField(
          controller: searchCtrl,
          onChanged: onSearch,
          textInputAction: TextInputAction.search,
          style: const TextStyle(fontSize: 14),
          decoration: InputDecoration(
            hintText: l10n.visitLeadSearch,
            prefixIcon: Icon(Icons.search_rounded, size: 20, color: colors.inkMuted),
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
              borderSide: const BorderSide(color: AppPalette.gold400, width: 1.5),
            ),
            suffixIcon: searchCtrl.text.isNotEmpty
                ? IconButton(
                    icon: Icon(Icons.clear_rounded, size: 18, color: colors.inkMuted),
                    onPressed: () {
                      searchCtrl.clear();
                      onSearch('');
                    },
                  )
                : null,
          ),
        ),
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
            child: Text(l10n.leadSearchEmpty,
                style: TextStyle(color: colors.inkMuted, fontSize: 13)),
          ),
        ] else ...[
          const SizedBox(height: AppSpacing.sm),
          Text(l10n.visitLeadSelect,
              style: TextStyle(color: colors.inkMuted, fontSize: 13)),
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
                      colors: [AppPalette.gold400, AppPalette.gold600]),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Center(
                  child: Text(initial,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 16)),
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
                            color: colors.inkStrong)),
                    if (phone != null)
                      Text(phone,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: colors.inkMuted)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, size: 18, color: colors.inkMuted),
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
        border: Border.all(color: AppPalette.gold400.withValues(alpha: 0.30)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                  colors: [AppPalette.gold300, AppPalette.gold500]),
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Center(
              child: Text(
                name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 15),
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
                        fontWeight: FontWeight.w700, color: colors.inkStrong)),
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
            child: Text(context.l10n.leadChangeClient,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Registered client picker — same pattern as _LeadPicker
// ═════════════════════════════════════════════════════════════════════════════

class _ClientPicker extends StatelessWidget {
  const _ClientPicker({
    required this.state,
    required this.searchCtrl,
    required this.onSearch,
    required this.onSelect,
  });
  final CreateVisitState state;
  final TextEditingController searchCtrl;
  final ValueChanged<String> onSearch;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);

    if (state.selectedClientId != null && state.clients.isNotEmpty) {
      final client = state.clients.firstWhere(
        (c) => c.clientId == state.selectedClientId,
        orElse: () => state.clients.first,
      );
      return _SelectedClientCard(
        client: client,
        colors: colors,
        theme: theme,
        onClear: () {
          searchCtrl.clear();
          onSearch('');
          onSelect(null);
        },
      );
    }

    if (state.clientsStatus == DataStatus.loading ||
        state.clientsStatus == DataStatus.initial) {
      return const _FieldLoader();
    }

    final filtered = state.filteredClients;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: searchCtrl,
          onChanged: onSearch,
          textInputAction: TextInputAction.search,
          style: const TextStyle(fontSize: 14),
          decoration: InputDecoration(
            hintText: l10n.visitClientSearch,
            prefixIcon: Icon(Icons.search_rounded, size: 20, color: colors.inkMuted),
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
              borderSide: const BorderSide(color: AppPalette.gold400, width: 1.5),
            ),
            suffixIcon: searchCtrl.text.isNotEmpty
                ? IconButton(
                    icon: Icon(Icons.clear_rounded, size: 18, color: colors.inkMuted),
                    onPressed: () {
                      searchCtrl.clear();
                      onSearch('');
                    },
                  )
                : null,
          ),
        ),
        if (filtered.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          ...filtered.take(6).map((c) => _ClientResultTile(
                client: c,
                colors: colors,
                theme: theme,
                onTap: () => onSelect(c.clientId),
              )),
        ] else if (searchCtrl.text.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Center(
            child: Text(l10n.leadSearchEmpty,
                style: TextStyle(color: colors.inkMuted, fontSize: 13)),
          ),
        ] else ...[
          const SizedBox(height: AppSpacing.sm),
          Text(l10n.visitClientSelect,
              style: TextStyle(color: colors.inkMuted, fontSize: 13)),
        ],
      ],
    );
  }
}

class _ClientResultTile extends StatelessWidget {
  const _ClientResultTile({
    required this.client,
    required this.colors,
    required this.theme,
    required this.onTap,
  });
  final StaffClient client;
  final AppColorsExt colors;
  final ThemeData theme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final initial = client.fullName.isNotEmpty
        ? client.fullName[0].toUpperCase()
        : '?';
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
                  color: colors.brandNavy,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Center(
                  child: Text(initial,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 16)),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(client.fullName,
                        style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: colors.inkStrong)),
                    if (client.phone != null)
                      Text(client.phone!,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: colors.inkMuted)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, size: 18, color: colors.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _SelectedClientCard extends StatelessWidget {
  const _SelectedClientCard({
    required this.client,
    required this.colors,
    required this.theme,
    required this.onClear,
  });
  final StaffClient client;
  final AppColorsExt colors;
  final ThemeData theme;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.brandNavy.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: colors.brandNavy.withValues(alpha: 0.20)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: colors.brandNavy,
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Center(
              child: Text(
                client.fullName.isNotEmpty
                    ? client.fullName[0].toUpperCase()
                    : '?',
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 15),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(client.fullName,
                    style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700, color: colors.inkStrong)),
                if (client.phone != null)
                  Text(client.phone!,
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
            child: Text(context.l10n.leadChangeClient,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Walk-in form — name + phone fields
// ═════════════════════════════════════════════════════════════════════════════

class _WalkInForm extends StatelessWidget {
  const _WalkInForm({
    required this.nameCtrl,
    required this.phoneCtrl,
    required this.onNameChanged,
    required this.onPhoneChanged,
    required this.showValidation,
  });
  final TextEditingController nameCtrl;
  final TextEditingController phoneCtrl;
  final ValueChanged<String> onNameChanged;
  final ValueChanged<String> onPhoneChanged;
  final bool showValidation;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppTextField(
                    controller: nameCtrl,
                    label: l10n.visitWalkInNameLabel,
                    hint: l10n.visitWalkInNameHint,
                    onChanged: onNameChanged,
                  ),
                  if (showValidation && nameCtrl.text.trim().isEmpty) ...[
                    const SizedBox(height: 4),
                    Text(l10n.visitWalkInNameRequired,
                        style: TextStyle(
                            color: colors.error, fontSize: 11)),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppTextField(
                    controller: phoneCtrl,
                    label: l10n.visitWalkInPhoneLabel,
                    hint: l10n.visitWalkInPhoneHint,
                    keyboardType: TextInputType.phone,
                    onChanged: onPhoneChanged,
                  ),
                  if (showValidation && phoneCtrl.text.trim().isEmpty) ...[
                    const SizedBox(height: 4),
                    Text(l10n.visitWalkInPhoneRequired,
                        style: TextStyle(
                            color: colors.error, fontSize: 11)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Project dropdown
// ═════════════════════════════════════════════════════════════════════════════

class _ProjectDropdown extends StatelessWidget {
  const _ProjectDropdown({required this.state});
  final CreateVisitState state;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final lang   = Localizations.localeOf(context).languageCode;
    final cubit  = context.read<CreateVisitCubit>();
    final colors = context.appColors;

    if (state.projectsStatus == DataStatus.loading ||
        state.projectsStatus == DataStatus.initial) {
      return const _FieldLoader();
    }
    if (state.projectsStatus == DataStatus.failure) {
      return ErrorState(failure: state.projectsFailure, onRetry: cubit.init);
    }
    if (state.projectsStatus == DataStatus.empty) {
      return EmptyState(
          icon: Icons.apartment_outlined, title: l10n.projectsEmptyTitle);
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
// Unit dropdown (optional)
// ═════════════════════════════════════════════════════════════════════════════

class _UnitDropdown extends StatelessWidget {
  const _UnitDropdown({required this.state});
  final CreateVisitState state;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final cubit  = context.read<CreateVisitCubit>();
    final colors = context.appColors;
    final theme  = Theme.of(context);

    if (state.unitsStatus == DataStatus.loading) return const _FieldLoader();

    final units = state.units;
    if (units.isEmpty) {
      return Text(l10n.visitNoUnits,
          style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted));
    }

    return _StyledDropdown<String?>(
      hint: l10n.visitSelectUnit,
      value: state.selectedUnitId,
      items: [
        DropdownMenuItem<String?>(value: null, child: Text(l10n.visitNoUnit)),
        for (final u in units)
          DropdownMenuItem<String?>(
            value: u.id,
            child: Text('${u.code}${u.type != null ? ' · ${u.type}' : ''}'),
          ),
      ],
      onChanged: (id) => cubit.selectUnit(id),
      colors: colors,
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Date/time tile
// ═════════════════════════════════════════════════════════════════════════════

class _DateTimeTile extends StatelessWidget {
  const _DateTimeTile({
    required this.scheduledAt,
    required this.lang,
    required this.onTap,
  });
  final DateTime? scheduledAt;
  final String lang;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n   = context.l10n;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
          decoration: BoxDecoration(
            color: colors.surfaceSoft,
            borderRadius: BorderRadius.circular(AppRadii.md),
            border: Border.all(color: colors.hairline),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppPalette.gold400.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.event_rounded,
                    color: AppPalette.gold400, size: 18),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  scheduledAt == null
                      ? l10n.visitPickDateTime
                      : DateFormatter.mediumDate(scheduledAt!, languageCode: lang),
                  style: scheduledAt == null
                      ? Theme.of(context)
                          .textTheme
                          .bodyLarge
                          ?.copyWith(color: colors.inkMuted)
                      : Theme.of(context).textTheme.bodyLarge?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: colors.inkStrong,
                          ),
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: colors.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Shared styled dropdown
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
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 4),
      child: DropdownButton<T>(
        value: value,
        isExpanded: true,
        underline: const SizedBox.shrink(),
        hint: Text(hint, style: TextStyle(color: colors.inkMuted, fontSize: 14)),
        items: items,
        onChanged: onChanged,
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Helpers
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
