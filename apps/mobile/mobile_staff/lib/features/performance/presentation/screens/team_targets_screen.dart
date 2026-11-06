import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../../contracts/create/contract_create_data.dart' show PickHit;
import '../../../contracts/create/manual_contract_screen.dart' show PickSheet;
import '../../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../domain/entities/sales_performance.dart';
import '../cubit/team_targets_cubit.dart';
import '../period.dart';
import '../period_picker.dart';

/// «إدارة الأهداف» (design t2): the period, the team's totals, a card per
/// target with edit, and a sheet to add or edit one.
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
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BlocProvider.value(value: cubit, child: TargetSheet(actors: cubit.state.actors, existing: target, period: cubit.state.period ?? currentPeriod())),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<TeamTargetsCubit>();
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocListener<TeamTargetsCubit, TeamTargetsState>(
          listenWhen: (a, b) => a.failure != b.failure && b.failure != null,
          listener: (context, state) => showFailureSnackBar(context, state.failure!),
          child: BlocBuilder<TeamTargetsCubit, TeamTargetsState>(
            builder: (context, state) {
              final period = state.period ?? currentPeriod();
              final mine = state.targets.where((t) => t.period == period).toList();
              final units = mine.fold<int>(0, (s, t) => s + t.unitsTarget);
              final amount = mine.fold<double>(0, (s, t) => s + (double.tryParse(t.amountTarget) ?? 0));
              final total = homeCompact(amount, l10n);
              final ready = state.status == DataStatus.success || state.status == DataStatus.empty;
              return Column(children: [
                HomeListHero(
                  title: l10n.teamTargetsManageTitle,
                  subtitle: ready ? l10n.tmCountN(mine.length) : null,
                  back: true,
                  actions: [HomeHeroButton(key: const Key('team-target-add'), icon: Icons.add_rounded, tooltip: l10n.teamTargetAdd, onTap: () => _showSheet())],
                ),
                Expanded(
                  child: switch (state.status) {
                    DataStatus.initial || DataStatus.loading => const StaffListSkeleton(rows: 4),
                    DataStatus.failure => ErrorState(failure: state.failure, onRetry: cubit.load),
                    _ => RefreshIndicator(
                        onRefresh: () => cubit.load(period: period),
                        child: ListView(padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24), children: [
                          PeriodBar(period: period, onPick: cubit.setPeriod, extra: [for (final t in state.targets) t.period]),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                            child: HomeBand(figures: [
                              HomeFigure(id: 'count', value: '${mine.length}', label: l10n.teamTargetRegistered, hint: periodLabel(period, lang)),
                              HomeFigure(id: 'units', value: '$units', label: l10n.teamTargetTotalUnits, hint: l10n.tmUnitsLine(units)),
                              HomeFigure(id: 'amount', value: total.$1, label: l10n.teamTargetTotalAmount, hint: [if (total.$2.isNotEmpty) total.$2, currency].join(' ')),
                            ]),
                          ),
                          if (mine.isEmpty)
                            EmptyState(icon: Icons.flag_rounded, title: l10n.teamTargetRegistered, message: l10n.tgNoTarget)
                          else
                            Padding(
                              padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                              child: Column(children: [
                                for (final t in mine)
                                  Padding(padding: const EdgeInsets.only(bottom: 10), child: _TargetCard(target: t, saving: state.savingId == t.salesId, onEdit: () => _showSheet(target: t))),
                              ]),
                            ),
                        ]),
                      ),
                  },
                ),
              ]);
            },
          ),
        ),
      ),
    );
  }
}

class _TargetCard extends StatelessWidget {
  const _TargetCard({required this.target, required this.onEdit, this.saving = false});
  final SalesTarget target;
  final VoidCallback onEdit;
  final bool saving;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: Key('team-target-${target.salesId}'),
        onTap: saving ? null : onEdit,
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: colors.hairline)),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(14)),
                child: Text(homeInitials(target.salesName), style: homeDisplay(14, AppPalette.gold300)),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(target.salesName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                  Text.rich(TextSpan(children: [
                    TextSpan(text: contractMoney(double.tryParse(target.amountTarget) ?? 0), style: homeDisplay(15, colors.inkStrong)),
                    TextSpan(text: ' $currency · ${l10n.tmUnitsLine(target.unitsTarget)}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                  ])),
                ]),
              ),
              if (saving) const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) else Icon(Icons.edit_rounded, size: 19, color: AppPalette.gold600),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Add or edit a target: the member, the month, the value and the units.
class TargetSheet extends StatefulWidget {
  const TargetSheet({super.key, required this.actors, required this.period, this.existing});
  final List<SalesActor> actors;
  final String period;
  final SalesTarget? existing;

  @override
  State<TargetSheet> createState() => _TargetSheetState();
}

class _TargetSheetState extends State<TargetSheet> {
  final _formKey = GlobalKey<FormState>();
  late String _period;
  String? _actorId;
  String? _actorName;
  late final TextEditingController _amount;
  late final TextEditingController _units;

  bool get _editing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _period = e?.period ?? widget.period;
    _actorId = e?.salesId;
    _actorName = e?.salesName;
    _amount = TextEditingController(text: e == null ? '' : (double.tryParse(e.amountTarget)?.toStringAsFixed(0) ?? e.amountTarget));
    _units = TextEditingController(text: e == null ? '' : '${e.unitsTarget}');
  }

  @override
  void dispose() {
    _amount.dispose();
    _units.dispose();
    super.dispose();
  }

  Future<void> _pickActor() async {
    final l10n = context.l10n;
    final hit = await showModalBottomSheet<PickHit>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PickSheet(
        title: l10n.teamTargetMember,
        hint: l10n.bcSearchUser,
        keyPrefix: 'target-actor',
        search: (q) async {
          final t = q.trim().toLowerCase();
          return [for (final a in widget.actors) if (t.isEmpty || a.fullName.toLowerCase().contains(t)) PickHit(a.id, a.fullName)].take(30).toList();
        },
      ),
    );
    if (hit == null) return;
    setState(() {
      _actorId = hit.id;
      _actorName = hit.title;
    });
  }

  Future<void> _save() async {
    if (_actorId == null || !(_formKey.currentState?.validate() ?? false)) {
      setState(() {});
      return;
    }
    FocusScope.of(context).unfocus();
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    final saved = context.l10n.teamTargetSaved;
    final ok = await context.read<TeamTargetsCubit>().upsertTarget(
          salesId: _actorId!,
          period: _period,
          amountTarget: _amount.text.trim(),
          unitsTarget: int.parse(_units.text.trim()),
        );
    if (ok && mounted) {
      messenger.showSnackBar(SnackBar(content: Text(saved)));
      nav.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    InputDecoration deco(String label) => InputDecoration(
          labelText: label,
          filled: true,
          fillColor: colors.surface,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: colors.hairline, width: 1.5)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: colors.hairline, width: 1.5)),
        );
    Widget box(String label, String text, VoidCallback? onTap, {Key? key, bool invalid = false}) => InkWell(
          key: key,
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: invalid ? colors.error : colors.hairline, width: 1.5)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              Text(text, style: TextStyle(fontSize: 13.5, color: colors.inkStrong)),
            ]),
          ),
        );
    return BlocBuilder<TeamTargetsCubit, TeamTargetsState>(
      builder: (context, state) {
        final saving = state.isSaving;
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
          child: Container(
            decoration: BoxDecoration(color: homeSheet(context), borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
            padding: EdgeInsets.fromLTRB(16, 14, 16, 16 + MediaQuery.paddingOf(context).bottom),
            child: Form(
              key: _formKey,
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Center(child: Container(width: 42, height: 5, decoration: BoxDecoration(color: homeLine(context), borderRadius: BorderRadius.circular(9)))),
                const SizedBox(height: 12),
                Text(_editing ? l10n.tmEditTitle : l10n.teamTargetAddNew, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                const SizedBox(height: 12),
                box(l10n.teamTargetMember, _actorName ?? l10n.bcSearchUser, _editing ? null : _pickActor, key: const Key('target-actor'), invalid: _actorId == null && !_editing && _formKey.currentState != null),
                const SizedBox(height: 8),
                box(l10n.tmPeriodField, periodLabel(_period, lang), _editing ? null : () async {
                  final p = await pickPeriod(context, current: _period);
                  if (p != null) setState(() => _period = p);
                }, key: const Key('target-period')),
                const SizedBox(height: 8),
                TextFormField(
                  key: const Key('target-amount'),
                  controller: _amount,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: deco(l10n.targetAmount),
                  validator: (v) => (v == null || v.trim().isEmpty) ? l10n.validationRequired : null,
                ),
                const SizedBox(height: 8),
                TextFormField(
                  key: const Key('target-units'),
                  controller: _units,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: deco(l10n.targetUnits),
                  validator: (v) => (v == null || v.trim().isEmpty) ? l10n.validationRequired : null,
                ),
                Padding(padding: const EdgeInsets.fromLTRB(2, 8, 2, 12), child: Text(l10n.tmSheetNote, style: TextStyle(fontSize: 12, color: colors.inkMuted))),
                Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: saving ? null : () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48), foregroundColor: colors.inkStrong, side: BorderSide(color: AppPalette.navy, width: 1.2), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15))),
                      child: Text(l10n.actionCancel),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      key: const Key('target-save'),
                      onPressed: saving ? null : _save,
                      icon: saving ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.navy)) : const Icon(Icons.save_rounded, size: 19),
                      label: Text(l10n.actionSave),
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48), backgroundColor: AppPalette.gold400, foregroundColor: AppPalette.navy, textStyle: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15))),
                    ),
                  ),
                ]),
              ]),
            ),
          ),
        );
      },
    );
  }
}
