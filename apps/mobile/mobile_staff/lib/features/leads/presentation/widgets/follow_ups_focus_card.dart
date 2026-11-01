import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/lead.dart';
import '../../domain/repositories/leads_repository.dart';

/// FU1 — the home screen's way into «المتابعات»: how many are overdue and
/// due today. Red when something is late. Hidden when the counts can't load.
class FollowUpsFocusCard extends StatefulWidget {
  const FollowUpsFocusCard({super.key});

  @override
  State<FollowUpsFocusCard> createState() => _FollowUpsFocusCardState();
}

class _FollowUpsFocusCardState extends State<FollowUpsFocusCard> {
  FollowUpSummary? _summary;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await context.read<LeadsRepository>().getFollowUpSummary();
    if (mounted) setState(() => _summary = result.dataOrNull);
  }

  @override
  Widget build(BuildContext context) {
    final s = _summary;
    if (s == null) return const SizedBox.shrink();
    final l10n = context.l10n;
    final colors = context.appColors;
    final text = Theme.of(context).textTheme;
    final late = s.overdue > 0;
    final accent = late ? colors.error : colors.brandGold;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Material(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        child: InkWell(
          key: const Key('follow-ups-focus'),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          onTap: () async {
            await context.push('/follow-ups');
            if (mounted) _load();
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.lg),
              border: Border.all(color: late ? colors.error.withValues(alpha: 0.35) : colors.hairline),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(color: accent.withValues(alpha: 0.12), shape: BoxShape.circle),
                  child: Icon(Icons.event_repeat_rounded, size: 18, color: accent),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l10n.followUpsTitle, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(
                        l10n.followUpsFocusLine(s.overdue, s.today),
                        style: text.bodySmall?.copyWith(color: late ? colors.error : colors.inkMuted),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.arrow_forward_ios_rounded, size: 14, color: colors.inkMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
