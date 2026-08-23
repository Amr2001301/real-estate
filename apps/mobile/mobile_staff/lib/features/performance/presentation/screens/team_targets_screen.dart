import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/sales_performance.dart';
import '../cubit/team_targets_cubit.dart';
import '../widgets/period_picker.dart';

String _currentPeriod() {
  final now = DateTime.now();
  return '${now.year}-${now.month.toString().padLeft(2, '0')}';
}

class TeamTargetsScreen extends StatefulWidget {
  const TeamTargetsScreen({super.key});

  @override
  State<TeamTargetsScreen> createState() => _TeamTargetsScreenState();
}

class _TeamTargetsScreenState extends State<TeamTargetsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<TeamTargetsCubit>().load();
  }

  void _showSheet({SalesTarget? target}) {
    final cubit = context.read<TeamTargetsCubit>();
    final state = cubit.state;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BlocProvider.value(
        value: cubit,
        child: _TargetSheet(
          actors: state.actors,
          existing: target,
          currentPeriod: state.period ?? _currentPeriod(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<TeamTargetsCubit>();
    final lang = Localizations.localeOf(context).languageCode;
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: BlocListener<TeamTargetsCubit, TeamTargetsState>(
        listenWhen: (a, b) => a.failure != b.failure && b.failure != null,
        listener: (context, state) => showFailureSnackBar(context, state.failure!),
        child: Column(
          children: [
            AppNavHeader(
              title: l10n.teamTargetsManageTitle,
              compact: true,
              leadingAction: NavHeaderAction(
                icon: Icons.arrow_back_ios_new_rounded,
                onTap: () => context.pop(),
              ),
              actions: [
                NavHeaderAction(
                  icon: Icons.add_rounded,
                  onTap: () => _showSheet(),
                ),
              ],
            ),
            Expanded(
              child: BlocBuilder<TeamTargetsCubit, TeamTargetsState>(
                builder: (context, state) {
                  switch (state.status) {
                    case DataStatus.initial:
                    case DataStatus.loading:
                      return const StaffListSkeleton(rows: 4);
                    case DataStatus.failure:
                      return ErrorState(
                          failure: state.failure, onRetry: cubit.load);
                    case DataStatus.empty:
                    case DataStatus.success:
                      return RefreshIndicator(
                        color: AppPalette.gold400,
                        onRefresh: cubit.load,
                        child: CustomScrollView(
                          slivers: [
                            // ── KPI summary ──────────────────────────────
                            SliverToBoxAdapter(
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(
                                    AppSpacing.lg, AppSpacing.md,
                                    AppSpacing.lg, AppSpacing.md),
                                child: _KpiGrid(state: state, lang: lang),
                              ),
                            ),

                            // ── Section header ───────────────────────────
                            SliverToBoxAdapter(
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(
                                    AppSpacing.lg, 0,
                                    AppSpacing.lg, AppSpacing.sm),
                                child: _SectionHeader(
                                  title: l10n.teamTargetRegistered,
                                  count: state.targetCount,
                                  trailing: TextButton.icon(
                                    onPressed: () => _showSheet(),
                                    icon: const Icon(Icons.add_rounded,
                                        size: 15),
                                    label: Text(l10n.teamTargetAdd),
                                    style: TextButton.styleFrom(
                                      foregroundColor:
                                          context.appColors.brandGold,
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: AppSpacing.sm,
                                          vertical: 4),
                                      textStyle: Theme.of(context)
                                          .textTheme
                                          .labelMedium
                                          ?.copyWith(
                                              fontWeight: FontWeight.w700),
                                    ),
                                  ),
                                ),
                              ),
                            ),

                            // ── Targets list or empty state ──────────────
                            if (state.targets.isEmpty)
                              SliverFillRemaining(
                                hasScrollBody: false,
                                child: _EmptyState(onAdd: () => _showSheet()),
                              )
                            else
                              SliverPadding(
                                padding: EdgeInsets.fromLTRB(
                                  AppSpacing.lg,
                                  0,
                                  AppSpacing.lg,
                                  bottomPad + AppSpacing.xl,
                                ),
                                sliver: SliverList.separated(
                                  itemCount: state.targets.length,
                                  separatorBuilder: (_, _) =>
                                      const SizedBox(height: AppSpacing.md),
                                  itemBuilder: (context, i) {
                                    final t = state.targets[i];
                                    return _TargetTile(
                                      target: t,
                                      lang: lang,
                                      saving: state.savingId == t.salesId,
                                      onEdit: () => _showSheet(target: t),
                                    );
                                  },
                                ),
                              ),
                          ],
                        ),
                      );
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── KPI grid ───────────────────────────────────────────────────────────────────

class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.state, required this.lang});
  final TeamTargetsState state;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final period = state.period ?? _currentPeriod();

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _KpiTile(
                icon: Icons.flag_rounded,
                iconColor: const Color(0xFF8B5CF6),
                label: l10n.teamTargetCount,
                value: '${state.targetCount}',
                colors: colors,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _KpiTile(
                icon: Icons.home_work_outlined,
                iconColor: const Color(0xFF22C55E),
                label: l10n.teamTargetTotalUnits,
                value: '${state.totalUnitsTarget}',
                colors: colors,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: _KpiTile(
                icon: Icons.monetization_on_outlined,
                iconColor: const Color(0xFFF59E0B),
                label: l10n.teamTargetTotalAmount,
                value: state.totalAmountTarget > 0
                    ? PriceFormatter.format(state.totalAmountTarget,
                        languageCode: lang)
                    : '—',
                colors: colors,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _KpiTile(
                icon: Icons.calendar_month_rounded,
                iconColor: const Color(0xFF3B82F6),
                label: l10n.teamPerfTitle,
                value: periodLabel(period, lang),
                colors: colors,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.colors,
  });
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.10),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 18, color: iconColor),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    label,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: colors.inkMuted,
                          fontSize: 10,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}

// ── Section header ─────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.count,
    this.trailing,
  });
  final String title;
  final int count;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          decoration: BoxDecoration(
            color: AppPalette.gold400,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          title,
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(width: AppSpacing.xs),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
          decoration: BoxDecoration(
            color: colors.surfaceSoft,
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(
            '$count',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colors.inkMuted,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
        const Spacer(),
        ?trailing,
      ],
    );
  }
}

// ── Target tile ────────────────────────────────────────────────────────────────

class _TargetTile extends StatelessWidget {
  const _TargetTile({
    required this.target,
    required this.lang,
    required this.saving,
    required this.onEdit,
  });
  final SalesTarget target;
  final String lang;
  final bool saving;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final initials = target.salesName.trim().isNotEmpty
        ? target.salesName.trim().split(' ').map((w) => w[0]).take(2).join()
        : '?';

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          // Thin gold accent strip
          Container(
            height: 3,
            decoration: BoxDecoration(
              color: colors.brandGold.withValues(alpha: 0.40),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(AppRadii.lg)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _GoldAvatar(initials: initials),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Name + period badge
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              target.salesName.isNotEmpty
                                  ? target.salesName
                                  : target.salesId,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w700),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppPalette.navy.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              periodLabel(target.period, lang),
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(
                                    color: AppPalette.navy,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      // Amount + units
                      Row(
                        children: [
                          Text(
                            PriceFormatter.formatString(target.amountTarget,
                                languageCode: lang),
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  color: colors.brandGold,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const Spacer(),
                          Icon(Icons.home_work_outlined,
                              size: 13, color: colors.inkMuted),
                          const SizedBox(width: 4),
                          Text(
                            '${target.unitsTarget} ${l10n.targetUnits}',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: colors.inkMuted),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                // Edit / saving indicator
                if (saving)
                  SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: colors.brandGold),
                  )
                else
                  GestureDetector(
                    onTap: onEdit,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: colors.brandGold.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(AppRadii.sm),
                        border: Border.all(
                            color: colors.brandGold.withValues(alpha: 0.30)),
                      ),
                      child: Text(
                        l10n.teamTargetEdit,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: colors.brandGold,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
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

// ── Empty state ────────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onAdd});
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                color: colors.surfaceSoft,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.flag_outlined, size: 30, color: colors.inkMuted),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              l10n.teamTargetRegistered,
              style: Theme.of(context)
                  .textTheme
                  .titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.teamTargetAddNew,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: colors.inkMuted),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: '+ ${l10n.teamTargetAdd}',
              variant: AppButtonVariant.gold,
              onPressed: onAdd,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Add / Edit bottom sheet ────────────────────────────────────────────────────

class _TargetSheet extends StatefulWidget {
  const _TargetSheet({
    required this.actors,
    required this.currentPeriod,
    this.existing,
  });
  final List<SalesActor> actors;
  final String currentPeriod;
  final SalesTarget? existing;

  @override
  State<_TargetSheet> createState() => _TargetSheetState();
}

class _TargetSheetState extends State<_TargetSheet> {
  final _formKey = GlobalKey<FormState>();
  late String _selectedPeriod;
  String? _selectedActorId;
  late final TextEditingController _amount;
  late final TextEditingController _units;

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    _selectedPeriod = widget.existing?.period ?? widget.currentPeriod;
    _selectedActorId = widget.existing?.salesId;
    _amount = TextEditingController(
      text: widget.existing != null
          ? (double.tryParse(widget.existing!.amountTarget)
                  ?.toStringAsFixed(0) ??
              widget.existing!.amountTarget)
          : '',
    );
    _units = TextEditingController(
      text: widget.existing != null ? '${widget.existing!.unitsTarget}' : '',
    );
  }

  @override
  void dispose() {
    _amount.dispose();
    _units.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final actorId = _isEditing ? widget.existing!.salesId : _selectedActorId;
    if (actorId == null) return;
    FocusScope.of(context).unfocus();
    final cubit = context.read<TeamTargetsCubit>();
    final ok = await cubit.upsertTarget(
      salesId: actorId,
      period: _selectedPeriod,
      amountTarget: _amount.text.trim(),
      unitsTarget: int.parse(_units.text.trim()),
    );
    if (ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.teamTargetSaved)));
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return BlocBuilder<TeamTargetsCubit, TeamTargetsState>(
      builder: (context, state) {
        final saving = _isEditing
            ? state.savingId == widget.existing!.salesId
            : state.isSaving;

        return Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(AppRadii.xxl)),
          ),
          padding: EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg,
              AppSpacing.lg, AppSpacing.lg + bottomPad),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Handle bar
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colors.hairline,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),

                // Title
                Text(
                  _isEditing
                      ? l10n.teamTargetFor(widget.existing!.salesName)
                      : l10n.teamTargetAdd,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: AppSpacing.lg),

                // ── Member picker (only when adding) ─────────────────────
                if (!_isEditing && widget.actors.isNotEmpty) ...[
                  _FieldLabel(l10n.teamTargetMember, colors: colors),
                  const SizedBox(height: 6),
                  Container(
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(AppRadii.md + 2),
                      border: Border.all(
                        color: _selectedActorId == null
                            ? colors.hairline
                            : colors.brandGold.withValues(alpha: 0.6),
                        width: _selectedActorId == null ? 0.8 : 1.8,
                      ),
                    ),
                    padding:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedActorId,
                        hint: Text(
                          l10n.teamTargetMember,
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                color: colors.inkMuted.withValues(alpha: 0.6),
                              ),
                        ),
                        isExpanded: true,
                        icon: Icon(Icons.expand_more_rounded,
                            color: colors.inkMuted),
                        items: widget.actors
                            .map((a) => DropdownMenuItem(
                                  value: a.id,
                                  child: Text(a.fullName),
                                ))
                            .toList(),
                        onChanged: (v) =>
                            setState(() => _selectedActorId = v),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],

                // ── Period picker button ──────────────────────────────────
                _FieldLabel(l10n.targetsTitle, colors: colors),
                const SizedBox(height: 6),
                GestureDetector(
                  onTap: () async {
                    final picked = await showPeriodPicker(
                      context,
                      initialPeriod: _selectedPeriod,
                    );
                    if (picked != null) {
                      setState(() => _selectedPeriod = picked);
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md, vertical: 13),
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(AppRadii.md + 2),
                      border: Border.all(
                        color: colors.brandGold.withValues(alpha: 0.50),
                        width: 1.4,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.calendar_month_rounded,
                            size: 18, color: colors.brandGold),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            periodLabel(_selectedPeriod, lang),
                            style: Theme.of(context)
                                .textTheme
                                .bodyLarge
                                ?.copyWith(
                                  color: colors.inkStrong,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ),
                        Icon(Icons.expand_more_rounded,
                            size: 18, color: colors.inkMuted),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // ── Amount field ─────────────────────────────────────────
                _SheetField(
                  controller: _amount,
                  label: l10n.targetAmount,
                  icon: Icons.monetization_on_outlined,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))
                  ],
                  textInputAction: TextInputAction.next,
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return l10n.validationRequired;
                    }
                    if (double.tryParse(v.trim()) == null) {
                      return l10n.validationRequired;
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppSpacing.md),

                // ── Units field ──────────────────────────────────────────
                _SheetField(
                  controller: _units,
                  label: l10n.targetUnits,
                  icon: Icons.home_work_outlined,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _save(),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return l10n.validationRequired;
                    }
                    if (int.tryParse(v.trim()) == null) {
                      return l10n.validationRequired;
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppSpacing.xl),

                AppButton(
                  label: l10n.actionSave,
                  variant: AppButtonVariant.gold,
                  expand: true,
                  isLoading: saving,
                  onPressed: saving ? null : _save,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

class _GoldAvatar extends StatelessWidget {
  const _GoldAvatar({required this.initials});
  final String initials;

  static const _g1 = Color(0xFFAA8528);
  static const _g2 = Color(0xFFC8A24B);

  @override
  Widget build(BuildContext context) => Container(
        width: 44,
        height: 44,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            colors: [_g1, _g2],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Center(
          child: Text(
            initials,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 15,
            ),
          ),
        ),
      );
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text, {required this.colors});
  final String text;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: colors.inkMuted,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.7,
            ),
      );
}

class _SheetField extends StatelessWidget {
  const _SheetField({
    required this.controller,
    required this.label,
    required this.icon,
    required this.keyboardType,
    this.inputFormatters,
    this.textInputAction,
    this.onFieldSubmitted,
    this.validator,
  });
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onFieldSubmitted;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    OutlineInputBorder border(Color c, [double w = 0.8]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md + 2),
          borderSide: BorderSide(color: c, width: w),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: colors.inkMuted,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.7,
              ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          textInputAction: textInputAction,
          onFieldSubmitted: onFieldSubmitted,
          validator: validator,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: colors.inkStrong,
                fontWeight: FontWeight.w500,
              ),
          decoration: InputDecoration(
            filled: true,
            fillColor: colors.surface,
            prefixIcon: Icon(icon, size: 18, color: colors.inkMuted),
            contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: AppSpacing.md + 2),
            border: border(colors.hairline),
            enabledBorder: border(colors.hairline),
            focusedBorder: border(colors.brandGold, 1.8),
            errorBorder: border(colors.error),
            focusedErrorBorder: border(colors.error, 1.8),
          ),
        ),
      ],
    );
  }
}
