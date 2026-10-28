import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../../domain/entities/lead.dart';
import '../cubit/lead_detail_cubit.dart';

/// LR1 — "why was this customer lost?", asked whenever a lead is moved to
/// LOST, as on the dashboard: one of the company's reasons (required) and an
/// optional word on what happened.
Future<void> showLostReasonSheet(BuildContext context, LeadDetailCubit cubit) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: LostReasonSheet(cubit: cubit),
    ),
  );
}

class LostReasonSheet extends StatefulWidget {
  const LostReasonSheet({super.key, required this.cubit});
  final LeadDetailCubit cubit;

  @override
  State<LostReasonSheet> createState() => _LostReasonSheetState();
}

class _LostReasonSheetState extends State<LostReasonSheet> {
  final _note = TextEditingController();
  List<LostReason>? _reasons;
  AppFailure? _failure;
  String? _picked;

  @override
  void initState() {
    super.initState();
    widget.cubit.lostReasons().then((result) {
      if (!mounted) return;
      result.when(
        ok: (reasons) => setState(() => _reasons = reasons),
        err: (failure) => setState(() {
          _reasons = const [];
          _failure = failure;
        }),
      );
    });
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _confirm() {
    final picked = _picked;
    if (picked == null) return;
    Navigator.of(context).pop();
    widget.cubit.markLost(picked, note: _note.text);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final text = Theme.of(context).textTheme;
    final lang = Localizations.localeOf(context).languageCode;
    final reasons = _reasons;

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.leadLostTitle, style: text.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          Text(l10n.leadLostHint, style: text.bodySmall?.copyWith(color: colors.inkMuted)),
          const SizedBox(height: AppSpacing.md),
          if (reasons == null)
            const Padding(
              padding: EdgeInsets.all(AppSpacing.lg),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_failure != null)
            Text(_failure!.userMessage(l10n), style: text.bodySmall?.copyWith(color: colors.error))
          else if (reasons.isEmpty)
            Text(l10n.leadLostEmpty, style: text.bodySmall?.copyWith(color: colors.inkMuted))
          else
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final r in reasons)
                  ChoiceChip(
                    key: ValueKey('lost-reason-${r.id}'),
                    label: Text(r.name.resolve(lang)),
                    selected: _picked == r.id,
                    onSelected: (_) => setState(() => _picked = r.id),
                  ),
              ],
            ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _note,
            maxLength: 1000,
            minLines: 2,
            maxLines: 4,
            decoration: InputDecoration(labelText: l10n.leadLostNote, counterText: ''),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: l10n.actionCancel,
                  variant: AppButtonVariant.ghost,
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppButton(
                  key: const Key('lost-confirm'),
                  label: l10n.leadLostConfirm,
                  icon: Icons.block_rounded,
                  onPressed: _picked == null ? null : _confirm,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
