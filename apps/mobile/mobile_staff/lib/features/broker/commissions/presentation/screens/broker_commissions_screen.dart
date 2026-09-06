import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../../common/broker_status_label.dart';
import '../../domain/entities/broker_commission.dart';
import '../cubit/broker_commissions_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);
const _navyLight = Color(0xFF243F62);

// ─────────────────────────────────────────────────────────────────────────────
// Broker Commissions Screen
// ─────────────────────────────────────────────────────────────────────────────

class BrokerCommissionsScreen extends StatefulWidget {
  const BrokerCommissionsScreen({super.key});

  @override
  State<BrokerCommissionsScreen> createState() => _State();
}

class _State extends State<BrokerCommissionsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<BrokerCommissionsCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final cubit = context.read<BrokerCommissionsCubit>();

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: Column(
          children: [
            // ── Gradient header ───────────────────────────────────────────
            const _CommissionsHeader(),

            // ── Pinned filter row ─────────────────────────────────────────
            BlocBuilder<BrokerCommissionsCubit, BrokerCommissionsState>(
              buildWhen: (a, b) =>
                  a.statusFilter != b.statusFilter ||
                  a.totalCount != b.totalCount ||
                  a.statusCounts.toString() != b.statusCounts.toString(),
              builder: (context, state) => _FilterRow(
                l10n: l10n,
                lang: lang,
                selected: state.statusFilter,
                total: state.totalCount,
                counts: state.statusCounts,
                onSelected: cubit.setStatus,
              ),
            ),

            // ── Scrollable body ───────────────────────────────────────────
            Expanded(
              child: BlocBuilder<BrokerCommissionsCubit, BrokerCommissionsState>(
                builder: (context, state) {
                  if (state.status == DataStatus.initial ||
                      state.status == DataStatus.loading) {
                    return _CommissionsSkeleton(
                      bottomPad: MediaQuery.of(context).padding.bottom,
                    );
                  }
                  if (state.status == DataStatus.failure) {
                    return ErrorState(
                      failure: state.failure,
                      onRetry: cubit.load,
                    );
                  }

                  return RefreshIndicator(
                    onRefresh: cubit.load,
                    child: ListView(
                      padding: EdgeInsets.fromLTRB(
                        AppSpacing.lg,
                        AppSpacing.lg,
                        AppSpacing.lg,
                        AppSpacing.xl +
                            MediaQuery.of(context).padding.bottom,
                      ),
                      children: [
                        // ── Overview KPI cards ─────────────────────────────
                        _Overview(state: state, l10n: l10n),
                        const SizedBox(height: AppSpacing.lg),

                        // ── Commission list / empty ────────────────────────
                        if (state.commissions.isEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: AppSpacing.xxl),
                            child: EmptyState(
                              icon: Icons.payments_outlined,
                              title: l10n.brokerCommissionsEmptyTitle,
                              message: l10n.brokerCommissionsEmptyMessage,
                            ),
                          )
                        else
                          for (final c in state.commissions) ...[
                            _CommissionTile(commission: c, lang: lang),
                            const SizedBox(height: AppSpacing.sm),
                          ],
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Gradient header ───────────────────────────────────────────────────────────

class _CommissionsHeader extends StatelessWidget {
  const _CommissionsHeader();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_navyLight, _navyMid, _navyDeep],
          stops: [0.0, 0.45, 1.0],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x35000000),
            blurRadius: 22,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
          PositionedDirectional(
            end: 0,
            top: 0,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.12),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 0,
            left: 48,
            right: 48,
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.0),
                    AppPalette.gold400.withValues(alpha: 0.5),
                    AppPalette.gold400.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.lg,
              topInset + AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.xl,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _BackBtn(),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        l10n.navCommissions,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'سجل العمولات والمستحقات',
                        style: TextStyle(
                          color: AppPalette.gold300,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.10),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppPalette.gold300.withValues(alpha: 0.35),
                    ),
                  ),
                  child: const Icon(
                    Icons.payments_rounded,
                    color: AppPalette.gold300,
                    size: 20,
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

// ── Pinned filter row ─────────────────────────────────────────────────────────

class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.l10n,
    required this.lang,
    required this.selected,
    required this.total,
    required this.counts,
    required this.onSelected,
  });

  final AppLocalizations l10n;
  final String lang;
  final String? selected;
  final int total;
  final Map<String, int> counts;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(
            bottom: BorderSide(color: colors.hairline, width: 0.5)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg, vertical: 6),
        child: Row(
          children: [
            _FilterChip(
              label: lang == 'ar' ? 'الكل' : 'All',
              count: total,
              active: selected == null,
              onTap: () => onSelected(null),
            ),
            for (final s in kBrokerCommissionStatuses) ...[
              const SizedBox(width: AppSpacing.xs),
              _FilterChip(
                label: brokerCommissionStatusLabel(l10n, s),
                count: counts[s] ?? 0,
                dotColor: _dotColor(s),
                active: selected == s,
                onTap: () => onSelected(selected == s ? null : s),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Color _dotColor(String s) => switch (s) {
        'APPROVED' => const Color(0xFF22C55E),
        'REJECTED' => const Color(0xFFEF4444),
        'CANCELLED' => const Color(0xFF94A3B8),
        _ => AppPalette.gold300,
      };
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.count,
    required this.active,
    required this.onTap,
    this.dotColor,
  });

  final String label;
  final int count;
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
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm + 4, vertical: 11),
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
            // Count badge
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.xs, vertical: 2),
              decoration: BoxDecoration(
                color: active
                    ? Colors.white.withValues(alpha: 0.18)
                    : colors.surfaceSoft,
                borderRadius: BorderRadius.circular(100),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: active ? Colors.white : colors.inkStrong,
                  height: 1.2,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            // Status dot — inactive only
            if (!active && dotColor != null) ...[
              Container(
                width: 6,
                height: 6,
                decoration:
                    BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: AppSpacing.xxs + 2),
            ],
            // Label
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

// ── Overview KPI card ─────────────────────────────────────────────────────────

class _Overview extends StatelessWidget {
  const _Overview({required this.state, required this.l10n});
  final BrokerCommissionsState state;
  final AppLocalizations l10n;

  static const _bg1 = Color(0xFF1C3352);
  static const _bg2 = Color(0xFF0F1E33);

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    String money(double v) => PriceFormatter.format(v, languageCode: lang);

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_bg1, _bg2],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: AppRadii.card,
        boxShadow: const [
          BoxShadow(
              color: Color(0x500F1E33), blurRadius: 22, offset: Offset(0, 8)),
        ],
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: AppRadii.card,
              child: const _DotTexture(),
            ),
          ),
          PositionedDirectional(
            top: -20,
            end: -20,
            child: Container(
              width: 120,
              height: 120,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0x1EC8A24B), Color(0x00C8A24B)],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Label row
                Row(
                  children: [
                    Text(
                      l10n.navCommissions,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.65),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: AppPalette.gold400.withValues(alpha: 0.40),
                        ),
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.circle,
                              size: 6, color: AppPalette.gold300),
                          const SizedBox(width: 4),
                          Text(
                            l10n.bonusStatusPending,
                            style: const TextStyle(
                              color: AppPalette.gold300,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Container(
                    height: 1,
                    color: Colors.white.withValues(alpha: 0.08)),
                const SizedBox(height: AppSpacing.sm),
                // Metrics row
                IntrinsicHeight(
                  child: Row(
                    children: [
                      _Metric(
                        value: money(state.approvedTotal),
                        label: l10n.bonusStatusApproved,
                        isGold: false,
                        valueColor: const Color(0xFF4ADE80),
                        icon: Icons.check_circle_rounded,
                        iconColor: const Color(0xFF4ADE80),
                      ),
                      _VDivider(),
                      _Metric(
                        value: money(state.pendingTotal),
                        label: l10n.bonusStatusPending,
                        isGold: true,
                        valueColor: AppPalette.gold300,
                        icon: Icons.schedule_rounded,
                        iconColor: AppPalette.gold300,
                      ),
                      _VDivider(),
                      _Metric(
                        value: '${state.totalCount}',
                        label: state.totalCount == 1
                            ? (Localizations.localeOf(context).languageCode ==
                                    'ar'
                                ? 'عمولة'
                                : 'commission')
                            : (Localizations.localeOf(context).languageCode ==
                                    'ar'
                                ? 'عمولة'
                                : 'total'),
                        isGold: false,
                        valueColor: Colors.white,
                        icon: Icons.payments_rounded,
                        iconColor: Colors.white,
                      ),
                    ],
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

class _Metric extends StatelessWidget {
  const _Metric({
    required this.value,
    required this.label,
    required this.isGold,
    required this.valueColor,
    required this.icon,
    required this.iconColor,
  });

  final String value;
  final String label;
  final bool isGold;
  final Color valueColor;
  final IconData icon;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: iconColor, size: 16),
          const SizedBox(height: 5),
          Text(
            value,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              height: 1.0,
              color: valueColor,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: Colors.white.withValues(alpha: 0.50),
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _VDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        width: 1,
        margin: const EdgeInsets.symmetric(vertical: 4),
        color: Colors.white.withValues(alpha: 0.10),
      );
}

// ── Commission tile ───────────────────────────────────────────────────────────

class _CommissionTile extends StatelessWidget {
  const _CommissionTile({
    required this.commission,
    required this.lang,
  });
  final BrokerCommission commission;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final accent = _accentColor(commission.status);
    final amountStr = commission.netAmount ?? commission.grossAmount;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.card,
        border: Border.all(color: colors.hairline.withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Top accent strip
          Container(height: 3, color: accent),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            child: Row(
              children: [
                // Circle icon badge
                Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [_navyLight, _navyDeep],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.payments_rounded,
                    color: AppPalette.gold300,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 13),

                // Content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Amount
                      Text(
                        amountStr != null
                            ? PriceFormatter.formatString(
                                amountStr,
                                languageCode: lang,
                              )
                            : '—',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: accent,
                          height: 1.1,
                        ),
                      ),
                      // Project
                      if (commission.projectName != null) ...[
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            Icon(
                              Icons.apartment_rounded,
                              size: 11,
                              color: colors.inkMuted,
                            ),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                commission.projectName!,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: colors.inkMuted,
                                  fontWeight: FontWeight.w500,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                      // Date
                      if (commission.createdAt != null) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(
                              Icons.calendar_today_rounded,
                              size: 11,
                              color: colors.inkMuted,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              DateFormatter.shortDate(
                                commission.createdAt!,
                                languageCode: lang,
                              ),
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: colors.inkMuted,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(width: 8),
                // Status badge
                StatusBadge(
                  label: brokerCommissionStatusLabel(l10n, commission.status),
                  tone: brokerCommissionStatusTone(commission.status),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _accentColor(String s) => switch (s) {
        'APPROVED' => const Color(0xFF22C55E),
        'REJECTED' || 'CANCELLED' => const Color(0xFFEF4444),
        _ => AppPalette.gold300,
      };
}

// ── Shared ────────────────────────────────────────────────────────────────────

class _BackBtn extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: const Icon(
          Icons.arrow_forward_ios_rounded,
          color: Colors.white,
          size: 16,
        ),
      ),
    );
  }
}

class _DotTexture extends StatelessWidget {
  const _DotTexture();

  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}

// ── Commissions loading skeleton ──────────────────────────────────────────────

class _CommissionsSkeleton extends StatelessWidget {
  const _CommissionsSkeleton({required this.bottomPad});
  final double bottomPad;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return AppSkeletonizer(
      enabled: true,
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.lg, AppSpacing.lg,
          AppSpacing.xl + bottomPad,
        ),
        children: [
          // ── Fake overview KPI card ────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: const Color(0xFF1C3352),
              borderRadius: AppRadii.card,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text('العمولات',
                      style: const TextStyle(color: Colors.white, fontSize: 13)),
                  const Spacer(),
                  Container(
                    width: 80, height: 22,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                    ),
                  ),
                ]),
                const SizedBox(height: AppSpacing.sm),
                Container(height: 1, color: Colors.white24),
                const SizedBox(height: AppSpacing.sm),
                IntrinsicHeight(
                  child: Row(
                    children: [
                      Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Icon(Icons.check_circle_rounded, size: 16, color: Colors.white54),
                        const SizedBox(height: 5),
                        Text('١٢٣٬٤٥٦ ج.م', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 5),
                        Text('معتمد', style: const TextStyle(color: Colors.white54, fontSize: 11)),
                      ])),
                      Container(width: 1, color: Colors.white24),
                      Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Icon(Icons.schedule_rounded, size: 16, color: Colors.white54),
                        const SizedBox(height: 5),
                        Text('٦٧٬٨٩٠ ج.م', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 5),
                        Text('قيد المراجعة', style: const TextStyle(color: Colors.white54, fontSize: 11)),
                      ])),
                      Container(width: 1, color: Colors.white24),
                      Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Icon(Icons.payments_rounded, size: 16, color: Colors.white54),
                        const SizedBox(height: 5),
                        Text('٥', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 5),
                        Text('الإجمالي', style: const TextStyle(color: Colors.white54, fontSize: 11)),
                      ])),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          // ── Fake commission tiles ─────────────────────────────────────────
          for (int i = 0; i < 5; i++) ...[
            Container(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: AppRadii.card,
                border: Border.all(color: colors.hairline.withValues(alpha: 0.4)),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(height: 3, color: colors.hairline),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                  child: Row(children: [
                    Container(
                      width: 44, height: 44,
                      decoration: const BoxDecoration(
                        color: _navyLight, shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 13),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('١٢٣٬٤٥٦ ج.م', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                      const SizedBox(height: 4),
                      Text('كمبوند الرياض الجديدة', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                      const SizedBox(height: 3),
                      Text('١٥/٠٦/٢٠٢٦', style: TextStyle(fontSize: 11, color: colors.inkMuted)),
                    ])),
                    const SizedBox(width: 8),
                    StatusBadge(label: 'قيد المراجعة', tone: BadgeTone.warning),
                  ]),
                ),
              ]),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ),
    );
  }
}
