import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/repositories/leads_repository.dart';
import '../cubit/create_lead_cubit.dart';

class CreateLeadScreen extends StatefulWidget {
  const CreateLeadScreen({super.key, this.interestContext});

  final LeadInterestContext? interestContext;

  @override
  State<CreateLeadScreen> createState() => _CreateLeadScreenState();
}

class _CreateLeadScreenState extends State<CreateLeadScreen> {
  final _nameCtrl  = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  void _submit(CreateLeadState state) {
    final l10n = context.l10n;
    if (state.clientMode == ClientPickerMode.pick &&
        state.selectedClient == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.leadSearchHint)),
      );
      return;
    }
    if (state.clientMode == ClientPickerMode.create) {
      if (_nameCtrl.text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.leadFullNameRequired)),
        );
        return;
      }
    }
    context.read<CreateLeadCubit>().submit(
          fullName: _nameCtrl.text.trim(),
          phone: _phoneCtrl.text.trim(),
          email: _emailCtrl.text.trim(),
          notes: _notesCtrl.text.trim(),
          projectInterestId: widget.interestContext?.projectId,
          unitInterestId: widget.interestContext?.unitId,
        );
  }

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;

    return BlocListener<CreateLeadCubit, CreateLeadState>(
      listenWhen: (a, b) => a.status != b.status,
      listener: (context, state) {
        if (state.status == CreateLeadStatus.success) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(l10n.leadCreated)));
          context.pop(true);
        } else if (state.status == CreateLeadStatus.failure) {
          showFailureSnackBar(context, state.failure!);
        }
      },
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: Column(
          children: [
            AppNavHeader(
              title: l10n.leadNew,
              compact: true,
              leadingAction: NavHeaderAction(
                icon: Icons.arrow_back_ios_new_rounded,
                onTap: () => context.pop(),
              ),
            ),
            Expanded(
              child: BlocBuilder<CreateLeadCubit, CreateLeadState>(
                builder: (context, state) => ListView(
                  padding: const EdgeInsets.fromLTRB(
                      AppSpacing.lg, AppSpacing.lg,
                      AppSpacing.lg, AppSpacing.xxl),
                  children: [
                    // ── Interest context banner ──────────────────────────
                    if (widget.interestContext != null) ...[
                      _ContextBanner(ctx: widget.interestContext!),
                      const SizedBox(height: AppSpacing.md),
                    ],

                    // ── Section 01: Client ───────────────────────────────
                    _SectionCard(
                      step: '01',
                      title: l10n.leadClientSection,
                      subtitle: l10n.leadClientSectionSubtitle,
                      child: _ClientPicker(
                        state: state,
                        nameCtrl: _nameCtrl,
                        phoneCtrl: _phoneCtrl,
                        emailCtrl: _emailCtrl,
                      ),
                    ),

                    const SizedBox(height: AppSpacing.md),

                    // ── Section 02: Interest & source ────────────────────
                    _SectionCard(
                      step: '02',
                      title: l10n.leadInterestSection,
                      subtitle: l10n.leadInterestSectionSubtitle,
                      child: _SourcePicker(
                        sources: state.sources,
                        loading: state.sourcesLoading,
                        selected: state.selectedSourceId,
                        onChanged:
                            context.read<CreateLeadCubit>().selectSource,
                      ),
                    ),

                    const SizedBox(height: AppSpacing.md),

                    // ── Section 03: Notes ────────────────────────────────
                    _SectionCard(
                      step: '03',
                      title: l10n.leadNotes,
                      subtitle: l10n.leadNotesSectionSubtitle,
                      child: AppTextField(
                        label: l10n.leadNotesHint,
                        controller: _notesCtrl,
                        maxLines: 4,
                        textInputAction: TextInputAction.done,
                      ),
                    ),

                    const SizedBox(height: AppSpacing.xl),

                    // ── Submit ───────────────────────────────────────────
                    AppButton(
                      label: l10n.leadCreate,
                      size: AppButtonSize.large,
                      variant: AppButtonVariant.gold,
                      expand: true,
                      isLoading: state.status == CreateLeadStatus.submitting,
                      onPressed: state.status == CreateLeadStatus.submitting
                          ? null
                          : () => _submit(state),
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

// ══════════════════════════════════════════════════════════════════════════════
// Interest context banner — shown when launched from project/unit detail
// ══════════════════════════════════════════════════════════════════════════════
class _ContextBanner extends StatelessWidget {
  const _ContextBanner({required this.ctx});
  final LeadInterestContext ctx;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);
    final label  = ctx.hasUnit
        ? '${l10n.leadContextUnit}: ${ctx.unitCode}'
        : '${l10n.leadContextProject}: ${ctx.projectName}';

    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppPalette.gold400.withValues(alpha: 0.12),
            AppPalette.gold300.withValues(alpha: 0.06),
          ],
        ),
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
            color: AppPalette.gold400.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppPalette.gold300, AppPalette.gold500],
              ),
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: const Icon(Icons.apartment_rounded,
                size: 16, color: Colors.white),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: colors.inkStrong,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Client picker — existing search or inline create
// ══════════════════════════════════════════════════════════════════════════════
class _ClientPicker extends StatefulWidget {
  const _ClientPicker({
    required this.state,
    required this.nameCtrl,
    required this.phoneCtrl,
    required this.emailCtrl,
  });

  final CreateLeadState state;
  final TextEditingController nameCtrl;
  final TextEditingController phoneCtrl;
  final TextEditingController emailCtrl;

  @override
  State<_ClientPicker> createState() => _ClientPickerState();
}

class _ClientPickerState extends State<_ClientPicker> {
  Timer? _debounce;
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearch(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 280), () {
      context.read<CreateLeadCubit>().searchClients(q);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final theme  = Theme.of(context);
    final state  = widget.state;
    final isPick = state.clientMode == ClientPickerMode.pick;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Mode toggle tabs
        _ModeToggle(
          isPick: isPick,
          l10n: l10n,
          colors: colors,
          onPickTap: context.read<CreateLeadCubit>().switchToPickMode,
          onCreateTap: context.read<CreateLeadCubit>().switchToCreateMode,
        ),
        const SizedBox(height: AppSpacing.md),

        if (isPick) ...[
          // ── Pick existing client ─────────────────────────────────────
          if (state.selectedClient != null) ...[
            _SelectedClientCard(
              client: state.selectedClient!,
              l10n: l10n,
              colors: colors,
              theme: theme,
              onClear: context.read<CreateLeadCubit>().clearClient,
            ),
          ] else ...[
            _SearchField(
              controller: _searchCtrl,
              l10n: l10n,
              colors: colors,
              onChanged: _onSearch,
            ),
            if (state.clientSearchLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                child: Center(
                  child: SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: AppPalette.gold400),
                  ),
                ),
              )
            else if (state.clientSearchResults.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              ...state.clientSearchResults.map((c) => _ClientResultTile(
                    client: c,
                    colors: colors,
                    theme: theme,
                    onTap: () {
                      context.read<CreateLeadCubit>().selectClient(c);
                      _searchCtrl.clear();
                    },
                  )),
            ] else if (_searchCtrl.text.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Center(
                child: Text(
                  l10n.leadSearchEmpty,
                  style: TextStyle(color: colors.inkMuted, fontSize: 13),
                ),
              ),
            ],
          ],
        ] else ...[
          // ── Create new client ────────────────────────────────────────
          AppTextField(
            label: l10n.leadFullName,
            controller: widget.nameCtrl,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: l10n.leadPhone,
            controller: widget.phoneCtrl,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: l10n.leadEmail,
            controller: widget.emailCtrl,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
          ),
        ],
      ],
    );
  }
}

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({
    required this.isPick,
    required this.l10n,
    required this.colors,
    required this.onPickTap,
    required this.onCreateTap,
  });

  final bool isPick;
  final AppLocalizations l10n;
  final AppColorsExt colors;
  final VoidCallback onPickTap;
  final VoidCallback onCreateTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: colors.hairline),
      ),
      padding: const EdgeInsets.all(3),
      child: Row(
        children: [
          _Tab(
            label: l10n.leadTabExisting,
            icon: Icons.search_rounded,
            active: isPick,
            colors: colors,
            onTap: onPickTap,
          ),
          _Tab(
            label: l10n.leadTabNew,
            icon: Icons.person_add_rounded,
            active: !isPick,
            colors: colors,
            onTap: onCreateTap,
          ),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({
    required this.label,
    required this.icon,
    required this.active,
    required this.colors,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool active;
  final AppColorsExt colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: active ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadii.sm),
            boxShadow: active
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.07),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    )
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 15,
                  color: active ? AppPalette.gold500 : colors.inkMuted),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight:
                      active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? colors.inkStrong : colors.inkMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.l10n,
    required this.colors,
    required this.onChanged,
  });

  final TextEditingController controller;
  final AppLocalizations l10n;
  final AppColorsExt colors;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      style: const TextStyle(fontSize: 14),
      decoration: InputDecoration(
        hintText: l10n.leadSearchHint,
        prefixIcon: Icon(Icons.search_rounded,
            size: 20, color: colors.inkMuted),
        filled: true,
        fillColor: colors.surfaceSoft,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 13),
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
      ),
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

  final ClientSearchResult client;
  final AppColorsExt colors;
  final ThemeData theme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final initial = client.fullName.isNotEmpty
        ? client.fullName[0].toUpperCase()
        : '?';
    final isCustomer = client.role == 'CUSTOMER';

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
              // Avatar
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: isCustomer
                        ? [
                            const Color(0xFF1E3A5F),
                            const Color(0xFF2D5A8E),
                          ]
                        : [AppPalette.gold400, AppPalette.gold600],
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
              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      client.fullName,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: colors.inkStrong,
                      ),
                    ),
                    if (client.phone != null || client.email != null)
                      Text(
                        client.phone ?? client.email!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colors.inkMuted,
                        ),
                      ),
                  ],
                ),
              ),
              // Role badge
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isCustomer
                      ? const Color(0xFF1E3A5F).withValues(alpha: 0.1)
                      : AppPalette.gold400.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Text(
                  isCustomer ? 'مالك' : 'عميل',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isCustomer
                        ? const Color(0xFF1E3A5F)
                        : AppPalette.gold600,
                  ),
                ),
              ),
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
    required this.l10n,
    required this.colors,
    required this.theme,
    required this.onClear,
  });

  final ClientSearchResult client;
  final AppLocalizations l10n;
  final AppColorsExt colors;
  final ThemeData theme;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppPalette.gold400.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(
            color: AppPalette.gold400.withValues(alpha: 0.3)),
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
                client.fullName.isNotEmpty
                    ? client.fullName[0].toUpperCase()
                    : '?',
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
                Text(
                  client.fullName,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colors.inkStrong,
                  ),
                ),
                if (client.phone != null)
                  Text(
                    client.phone!,
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: colors.inkMuted),
                  ),
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
            child: Text(l10n.leadChangeClient,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Source picker
// ══════════════════════════════════════════════════════════════════════════════
class _SourcePicker extends StatelessWidget {
  const _SourcePicker({
    required this.sources,
    required this.loading,
    required this.selected,
    required this.onChanged,
  });

  final List<LeadSource> sources;
  final bool loading;
  final String? selected;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;

    if (loading) {
      return const SizedBox(
        height: 52,
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

    if (sources.isEmpty) {
      return Text(
        l10n.leadSourceEmpty,
        style: TextStyle(color: colors.inkMuted, fontSize: 13),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: colors.hairline),
      ),
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: 4),
      child: DropdownButton<String>(
        value: selected,
        isExpanded: true,
        underline: const SizedBox.shrink(),
        hint: Text(l10n.leadSourceHint,
            style: TextStyle(color: colors.inkMuted, fontSize: 14)),
        items: sources
            .map((s) => DropdownMenuItem<String>(
                  value: s.id,
                  child: Text(s.name),
                ))
            .toList(),
        onChanged: onChanged,
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Section card
// ══════════════════════════════════════════════════════════════════════════════
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
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.lg,
                AppSpacing.lg, AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
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
