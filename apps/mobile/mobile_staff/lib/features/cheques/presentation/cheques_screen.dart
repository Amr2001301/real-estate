import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/staff_list_skeleton.dart';
import '../../leads/presentation/follow_up_labels.dart';
import '../domain/cheque.dart';
import 'cheques_cubit.dart';

String chequeStatusLabel(AppLocalizations l10n, String status) => switch (status) {
      'PENDING_CLEARANCE' => l10n.chequeStatusPending,
      'DEPOSITED' => l10n.chequeStatusDeposited,
      'CLEARED' => l10n.chequeStatusCleared,
      'BOUNCED' => l10n.chequeStatusBounced,
      'REPLACED' => l10n.chequeStatusReplaced,
      'CANCELLED' => l10n.chequeStatusCancelled,
      _ => status,
    };

BadgeTone chequeStatusTone(String status) => switch (status) {
      'PENDING_CLEARANCE' => BadgeTone.warning,
      'DEPOSITED' => BadgeTone.info,
      'CLEARED' => BadgeTone.success,
      'BOUNCED' => BadgeTone.error,
      _ => BadgeTone.neutral,
    };

Color chequeStatusColor(String status, AppColorsExt c) => switch (status) {
      'PENDING_CLEARANCE' => c.warning,
      'DEPOSITED' => c.info,
      'CLEARED' => c.success,
      'BOUNCED' => c.error,
      _ => c.inkMuted,
    };

String chequeMoney(num? amount, String lang) =>
    amount == null ? '—' : latinDigits(PriceFormatter.format(amount, languageCode: lang));

/// FG-01 — «الشيكات»: customers' cheques by status, soonest due first, as on
/// the dashboard. Admin and sales manager only. Read-only for now.
class ChequesScreen extends StatefulWidget {
  const ChequesScreen({super.key});

  @override
  State<ChequesScreen> createState() => _ChequesScreenState();
}

class _ChequesScreenState extends State<ChequesScreen> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<ChequesCubit>().load();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) {
        context.read<ChequesCubit>().loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ChequesCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.chequesTitle,
            compact: true,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.canPop() ? context.pop() : context.go('/home'),
            ),
          ),
          const _StatusFilter(),
          Expanded(
            child: BlocBuilder<ChequesCubit, ChequesState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: l10n.chequesEmpty,
                      message: l10n.chequesEmptyHint,
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: ListView.separated(
                        controller: _scroll,
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, bottomPad + 100),
                        itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
                        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) {
                          if (i >= state.items.length) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                              child: Center(child: CircularProgressIndicator()),
                            );
                          }
                          final c = state.items[i];
                          return _ChequeTile(
                            cheque: c,
                            onTap: () => context.push('/cheques/${c.id}', extra: c),
                          );
                        },
                      ),
                    );
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ── Status filter bar (as on the reservations list) ──────────────────────────

class _StatusFilter extends StatelessWidget {
  const _StatusFilter();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final cubit = context.read<ChequesCubit>();
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(bottom: BorderSide(color: colors.hairline, width: 0.5)),
      ),
      child: BlocBuilder<ChequesCubit, ChequesState>(
        buildWhen: (a, b) => a.filter != b.filter,
        builder: (context, state) => SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: 6),
          child: Row(
            children: [
              for (final s in kChequeStatuses) ...[
                if (s != kChequeStatuses.first) const SizedBox(width: AppSpacing.xs),
                _StatusChip(
                  key: ValueKey('cheque-filter-$s'),
                  label: chequeStatusLabel(l10n, s),
                  active: state.filter == s,
                  dotColor: chequeStatusColor(s, colors),
                  onTap: () => cubit.setFilter(s),
                ),
              ],
              const SizedBox(width: AppSpacing.xs),
              _StatusChip(
                key: const ValueKey('cheque-filter-all'),
                label: l10n.leadsFilterAll,
                active: state.filter == null,
                onTap: () => cubit.setFilter(null),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({super.key, required this.label, required this.active, required this.onTap, this.dotColor});
  final String label;
  final bool active;
  final VoidCallback onTap;
  final Color? dotColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm + 4, vertical: 11),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(color: active ? colors.brandNavy : colors.hairline, width: active ? 0 : 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!active && dotColor != null) ...[
              Container(width: 6, height: 6, decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle)),
              const SizedBox(width: AppSpacing.xxs + 2),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                color: active ? Colors.white : colors.inkStrong,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Cheque tile ───────────────────────────────────────────────────────────────

class _ChequeTile extends StatefulWidget {
  const _ChequeTile({required this.cheque, required this.onTap});
  final Cheque cheque;
  final VoidCallback onTap;

  @override
  State<_ChequeTile> createState() => _ChequeTileState();
}

class _ChequeTileState extends State<_ChequeTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final c = widget.cheque;
    final accent = chequeStatusColor(c.status, colors);
    final dueNow = c.dueForDeposit(DateTime.now());

    return GestureDetector(
      key: ValueKey('cheque-${c.id}'),
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadii.card,
            border: Border.all(color: accent.withValues(alpha: 0.16), width: 0.9),
            boxShadow: [
              BoxShadow(color: accent.withValues(alpha: 0.10), blurRadius: 20, offset: const Offset(0, 6)),
              BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0, 2)),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                height: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: isRtl ? Alignment.centerRight : Alignment.centerLeft,
                    end: isRtl ? Alignment.centerLeft : Alignment.centerRight,
                    colors: [accent, accent.withValues(alpha: 0.0)],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.md, 13, AppSpacing.md, 13),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: 0.10),
                            shape: BoxShape.circle,
                            border: Border.all(color: accent.withValues(alpha: 0.28), width: 1.2),
                          ),
                          child: Icon(Icons.receipt_long_rounded, color: accent, size: 22),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                c.customer ?? (c.number != null ? '#${c.number}' : l10n.chequesTitle),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 15.5,
                                  fontWeight: FontWeight.w700,
                                  color: colors.inkStrong,
                                  height: 1.2,
                                  letterSpacing: -0.2,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                [
                                  if (c.number != null) '#${c.number}',
                                  if (c.bank != null) c.bank!,
                                ].join(' · '),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12, color: colors.inkMuted, height: 1.3),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            StatusBadge(label: chequeStatusLabel(l10n, c.status), tone: chequeStatusTone(c.status)),
                            const SizedBox(height: 4),
                            Icon(Icons.chevron_right_rounded, size: 16, color: colors.inkMuted.withValues(alpha: 0.5)),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Container(height: 0.5, color: colors.hairline),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        _InfoChip(
                          icon: Icons.payments_outlined,
                          label: chequeMoney(c.amount, lang),
                          color: colors.brandGold,
                        ),
                        if (c.dueDate != null)
                          _InfoChip(
                            icon: Icons.calendar_today_rounded,
                            label: followUpDate(c.dueDate!, lang),
                            color: dueNow ? colors.error : colors.brandNavy,
                          ),
                        if (dueNow)
                          _InfoChip(icon: Icons.account_balance_rounded, label: l10n.chequeDueForDeposit, color: colors.error),
                        if (c.contractNumber != null)
                          _InfoChip(icon: Icons.description_outlined, label: c.contractNumber!, color: colors.inkMuted),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label, required this.color});
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        border: Border.all(color: color.withValues(alpha: 0.20)),
        borderRadius: AppRadii.pillAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color.withValues(alpha: 0.80)),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color, height: 1.2),
            ),
          ),
        ],
      ),
    );
  }
}
