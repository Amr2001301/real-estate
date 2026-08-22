import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/bonus_status_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/bonus_entry.dart';
import '../cubit/bonus_cubit.dart';

const _bonusStatuses = ['PENDING', 'APPROVED', 'PAID'];

class BonusScreen extends StatefulWidget {
  const BonusScreen({super.key});

  @override
  State<BonusScreen> createState() => _BonusScreenState();
}

class _BonusScreenState extends State<BonusScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BonusCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n      = context.l10n;
    final cubit     = context.read<BonusCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: l10n.bonusTitle,
            compact: true,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          BlocBuilder<BonusCubit, BonusState>(
            buildWhen: (a, b) => a.statusFilter != b.statusFilter,
            builder: (context, state) =>
                _StatusFilter(selected: state.statusFilter),
          ),
          Expanded(
            child: BlocBuilder<BonusCubit, BonusState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(
                        failure: state.failure, onRetry: cubit.load);
                  case DataStatus.empty:
                  case DataStatus.success:
                    return RefreshIndicator(
                      color: AppPalette.gold400,
                      onRefresh: cubit.load,
                      child: ListView(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          AppSpacing.md,
                          AppSpacing.md,
                          bottomPad + AppSpacing.xl,
                        ),
                        children: [
                          _HeroCard(state: state),
                          const SizedBox(height: AppSpacing.lg),
                          if (state.entries.isEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: AppSpacing.xl),
                              child: EmptyState(
                                icon: Icons.payments_outlined,
                                title: l10n.bonusEmptyTitle,
                                message: l10n.bonusEmptyMessage,
                              ),
                            )
                          else ...[
                            Padding(
                              padding: const EdgeInsets.only(
                                  right: AppSpacing.xs, bottom: AppSpacing.sm),
                              child: Text(
                                l10n.bonusTitle,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: context.appColors.inkMuted,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ),
                            for (final e in state.entries) ...[
                              _BonusTile(entry: e),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                          ],
                        ],
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

// ── Hero overview card ────────────────────────────────────────────────────────

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.state});
  final BonusState state;

  @override
  Widget build(BuildContext context) {
    final lang  = Localizations.localeOf(context).languageCode;
    final isRtl = context.read<LocaleCubit>().isRtl;
    final ov    = state.overview;
    final total = ov.paidTotal + ov.pendingTotal;

    String money(double v) => PriceFormatter.format(v, languageCode: lang);

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0A1628), Color(0xFF152238), Color(0xFF0D1E30)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0A1628).withValues(alpha: 0.45),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
          BoxShadow(
            color: AppPalette.gold400.withValues(alpha: 0.06),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Subtle radial glow top-center
          Positioned(
            top: -40, left: 0, right: 0,
            child: Container(
              height: 120,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.10),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                  radius: 0.8,
                ),
              ),
            ),
          ),
          // Gold shimmer top strip
          Positioned(
            top: 0, left: 0, right: 0,
            child: Container(
              height: 2,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.0),
                    AppPalette.gold400,
                    AppPalette.gold300,
                    AppPalette.gold400,
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                  begin: isRtl ? Alignment.centerRight : Alignment.centerLeft,
                  end:   isRtl ? Alignment.centerLeft  : Alignment.centerRight,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Label row
                Row(
                  children: [
                    const Icon(
                      Icons.account_balance_wallet_rounded,
                      size: 14,
                      color: AppPalette.gold400,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      lang == 'ar'
                          ? 'إجمالي المكافآت والعمولات'
                          : 'Total Bonuses & Commissions',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Colors.white54,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Total amount — large + gold
                Text(
                  money(total),
                  style: const TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w800,
                    color: AppPalette.gold400,
                    letterSpacing: -1.0,
                    height: 1.05,
                  ),
                ),
                const SizedBox(height: 5),
                // Entry count pill
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Text(
                    lang == 'ar' ? '${ov.count} إدخال' : '${ov.count} entries',
                    style: const TextStyle(
                      fontSize: 11,
                      color: Colors.white54,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                // Sub-stat boxes
                Row(
                  children: [
                    Expanded(
                      child: _StatBox(
                        icon: Icons.check_circle_rounded,
                        label: lang == 'ar' ? 'مدفوع' : 'Paid',
                        value: money(ov.paidTotal),
                        color: const Color(0xFF22C55E),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _StatBox(
                        icon: Icons.hourglass_top_rounded,
                        label: lang == 'ar' ? 'معلّق' : 'Pending',
                        value: money(ov.pendingTotal),
                        color: const Color(0xFFF59E0B),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  const _StatBox({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 12, color: color),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: color.withValues(alpha: 0.80),
                  height: 1.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: color,
              letterSpacing: -0.4,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Status filter ─────────────────────────────────────────────────────────────

const _kBonusDotColors = <String, Color>{
  'PENDING':  Color(0xFFF59E0B),
  'APPROVED': Color(0xFF60A5FA),
  'PAID':     Color(0xFF22C55E),
};

class _StatusFilter extends StatelessWidget {
  const _StatusFilter({this.selected});
  final String? selected;

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final cubit  = context.read<BonusCubit>();
    final colors = context.appColors;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(
          bottom: BorderSide(color: colors.hairline, width: 0.5),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: 6,
        ),
        child: Row(
          children: [
            _StatusChip(
              label: l10n.leadsFilterAll,
              active: selected == null,
              onTap: () => cubit.setStatus(null),
            ),
            for (final s in _bonusStatuses) ...[
              const SizedBox(width: AppSpacing.xs),
              _StatusChip(
                label: bonusStatusLabel(l10n, s),
                active: selected == s,
                dotColor: _kBonusDotColors[s],
                onTap: () => cubit.setStatus(s),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.active,
    required this.onTap,
    this.dotColor,
  });
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
          border: Border.all(
            color: active ? colors.brandNavy : colors.hairline,
            width: active ? 0 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!active && dotColor != null) ...[
              Container(
                width: 6, height: 6,
                decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
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

// ── Bonus tile ────────────────────────────────────────────────────────────────

class _BonusTile extends StatefulWidget {
  const _BonusTile({required this.entry});
  final BonusEntry entry;

  @override
  State<_BonusTile> createState() => _BonusTileState();
}

class _BonusTileState extends State<_BonusTile> {
  bool _pressed = false;
  BonusEntry get entry => widget.entry;

  static Color _statusColor(String status, AppColorsExt c) => switch (status) {
    'PAID'     => c.success,
    'APPROVED' => c.info,
    'PENDING'  => c.warning,
    _          => c.inkMuted,
  };

  static IconData _statusIcon(String status) => switch (status) {
    'PAID'     => Icons.check_circle_rounded,
    'APPROVED' => Icons.verified_rounded,
    'PENDING'  => Icons.hourglass_top_rounded,
    _          => Icons.payments_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final colors = context.appColors;
    final lang   = Localizations.localeOf(context).languageCode;
    final isRtl  = context.read<LocaleCubit>().isRtl;
    final tone   = bonusStatusTone(entry.status);
    final accent = _statusColor(entry.status, colors);
    final date   = entry.paidAt ?? entry.createdAt;

    final meta = [
      if (entry.ruleName != null) entry.ruleName!,
      entry.period,
      if (entry.commissionPct != null) '${entry.commissionPct}%',
    ].join(' · ');

    return GestureDetector(
      onTapDown:   (_) => setState(() => _pressed = true),
      onTapUp:     (_) => setState(() => _pressed = false),
      onTapCancel: ()  => setState(() => _pressed = false),
      child: AnimatedScale(
        scale:    _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve:    Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color:        colors.surface,
            borderRadius: AppRadii.card,
            border:       Border.all(color: accent.withValues(alpha: 0.15), width: 0.8),
            boxShadow: [
              BoxShadow(
                color:      accent.withValues(alpha: 0.08),
                blurRadius: 16,
                offset:     const Offset(0, 4),
              ),
              BoxShadow(
                color:      Colors.black.withValues(alpha: 0.04),
                blurRadius: 6,
                offset:     const Offset(0, 2),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top gradient strip
              Container(
                height: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin:  isRtl ? Alignment.centerRight : Alignment.centerLeft,
                    end:    isRtl ? Alignment.centerLeft  : Alignment.centerRight,
                    colors: [accent, accent.withValues(alpha: 0.0)],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md, AppSpacing.sm,
                  AppSpacing.md, AppSpacing.sm,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Status icon circle
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color:  accent.withValues(alpha: 0.10),
                        shape:  BoxShape.circle,
                        border: Border.all(color: accent.withValues(alpha: 0.25)),
                      ),
                      child: Icon(_statusIcon(entry.status), color: accent, size: 20),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    // Content
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            PriceFormatter.formatString(entry.amount, languageCode: lang),
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: colors.inkStrong,
                              letterSpacing: -0.4,
                              height: 1.2,
                            ),
                          ),
                          if (meta.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              meta,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12,
                                color: colors.inkMuted,
                                height: 1.3,
                              ),
                            ),
                          ],
                          if (date != null) ...[
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Icon(Icons.schedule_rounded, size: 11, color: colors.inkMuted),
                                const SizedBox(width: 3),
                                Text(
                                  DateFormatter.shortDate(date, languageCode: lang),
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: colors.inkMuted,
                                    height: 1.2,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    StatusBadge(
                      label: bonusStatusLabel(l10n, entry.status),
                      tone:  tone,
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
