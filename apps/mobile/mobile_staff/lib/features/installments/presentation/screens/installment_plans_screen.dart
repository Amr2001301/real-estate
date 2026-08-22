import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/installment.dart';
import '../cubit/installment_plans_cubit.dart';

const _navy = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

class InstallmentPlansScreen extends StatefulWidget {
  const InstallmentPlansScreen({super.key});

  @override
  State<InstallmentPlansScreen> createState() => _InstallmentPlansScreenState();
}

class _InstallmentPlansScreenState extends State<InstallmentPlansScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<InstallmentPlansCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      body: Column(
        children: [
          _PlansHeader(
            l10n: l10n,
            searchController: _search,
            onSearch: context.read<InstallmentPlansCubit>().search,
          ),
          Expanded(
            child: BlocBuilder<InstallmentPlansCubit, InstallmentPlansState>(
              builder: (context, state) {
                if (state.status == DataStatus.loading ||
                    state.status == DataStatus.initial) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (state.status == DataStatus.failure) {
                  return _ErrorView(
                    onRetry: () => context.read<InstallmentPlansCubit>().load(),
                  );
                }
                final plans = state.filtered;
                if (plans.isEmpty) {
                  return _EmptyView(l10n: l10n);
                }
                return ListView.separated(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.xl + bottomPad,
                  ),
                  itemCount: plans.length,
                  separatorBuilder: (_, i) =>
                      const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, i) => _PlanCard(
                    template: plans[i],
                    l10n: l10n,
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/calculator'),
        tooltip: l10n.planTemplatesOpenCalculator,
        child: const Icon(Icons.calculate_rounded),
      ),
    );
  }
}

// ── Navy hero header with search bar ─────────────────────────────────────────

class _PlansHeader extends StatelessWidget {
  const _PlansHeader({
    required this.l10n,
    required this.searchController,
    required this.onSearch,
  });
  final AppLocalizations l10n;
  final TextEditingController searchController;
  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;

    return Container(
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [_navyLight, _navyCard, _navy],
          stops: [0.0, 0.45, 1.0],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x40000000),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          // gold radial glow top-end
          PositionedDirectional(
            end: 0,
            top: 0,
            child: Container(
              width: 160,
              height: 130,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.0,
                  colors: [
                    AppPalette.gold400.withValues(alpha: 0.10),
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
              AppSpacing.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // back + title row
                Row(
                  children: [
                    _CircleBack(onTap: () => context.pop()),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.planTemplatesTitle,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.3,
                              height: 1.1,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            l10n.planTemplatesSubtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.55),
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                // Search bar — white pill matching clients/contracts screens
                _PlansSearchBar(
                  controller: searchController,
                  hint: l10n.planTemplatesSearch,
                  onChanged: onSearch,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Plan template card ────────────────────────────────────────────────────────

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.template, required this.l10n});
  final InstallmentPlanTemplate template;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md + 2,
              AppSpacing.md,
              AppSpacing.md,
            ),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [_navyLight, _navy],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.receipt_long_rounded,
                    size: 20,
                    color: AppPalette.gold300,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        template.name,
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: colors.inkStrong,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        l10n.planTemplatesMonths(
                          template.durations.isNotEmpty
                              ? template.durations.map((d) => d.durationMonths).reduce((a, b) => a > b ? a : b)
                              : 0,
                        ),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colors.inkMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                // Use plan → go to calculator
                Material(
                  color: AppPalette.gold400.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(10),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () => context.push(
                      '/calculator',
                      extra: {
                        'templateId': template.id,
                      },
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 7,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.calculate_rounded,
                            size: 14,
                            color: AppPalette.gold500,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            l10n.calculatorTitle,
                            style: const TextStyle(
                              color: AppPalette.gold500,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Duration chips
          if (template.durations.isNotEmpty) ...[
            Container(
              height: 1,
              color: AppPalette.gold400.withValues(alpha: 0.08),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.md,
              ),
              child: Wrap(
                spacing: 8,
                runSpacing: 6,
                children: template.durations.map((d) {
                  return _DurationPill(
                    months: d.durationMonths,
                    increase: d.increasePercentage,
                    l10n: l10n,
                    onTap: () => context.push(
                      '/calculator',
                      extra: {
                        'templateId': template.id,
                        'durationMonths': d.durationMonths,
                        'increasePercentage': d.increasePercentage,
                      },
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _DurationPill extends StatelessWidget {
  const _DurationPill({
    required this.months,
    required this.increase,
    required this.l10n,
    required this.onTap,
  });
  final int months;
  final double increase;
  final AppLocalizations l10n;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF8EC),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: AppPalette.gold400.withValues(alpha: 0.30),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.calendar_month_rounded,
              size: 12,
              color: Color(0xFFB8973A),
            ),
            const SizedBox(width: 5),
            Text(
              l10n.planTemplatesMonths(months),
              style: const TextStyle(
                color: _navy,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (increase > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: AppPalette.gold400.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '+${increase.toStringAsFixed(increase.truncateToDouble() == increase ? 0 : 1)}%',
                  style: const TextStyle(
                    color: Color(0xFFB8973A),
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyView extends StatelessWidget {
  const _EmptyView({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFF4D6), Color(0xFFFFE5A0)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(22),
              ),
              child: const Icon(
                Icons.receipt_long_rounded,
                size: 34,
                color: AppPalette.gold500,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              l10n.planTemplatesEmpty,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: colors.inkStrong,
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.planTemplatesEmptyDesc,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: colors.inkMuted,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Error state ───────────────────────────────────────────────────────────────

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline_rounded, size: 40, color: colors.error),
          const SizedBox(height: AppSpacing.md),
          Text(
            context.l10n.errorUnknown,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: colors.inkMuted),
          ),
          const SizedBox(height: AppSpacing.md),
          AppButton(
            label: context.l10n.actionRetry,
            variant: AppButtonVariant.outline,
            onPressed: onRetry,
          ),
        ],
      ),
    );
  }
}

// ── White-pill search bar ─────────────────────────────────────────────────────

class _PlansSearchBar extends StatefulWidget {
  const _PlansSearchBar({
    required this.controller,
    required this.hint,
    required this.onChanged,
  });
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  State<_PlansSearchBar> createState() => _PlansSearchBarState();
}

class _PlansSearchBarState extends State<_PlansSearchBar> {
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onControllerChange);
  }

  void _onControllerChange() {
    final has = widget.controller.text.isNotEmpty;
    if (has != _hasText) setState(() => _hasText = has);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onControllerChange);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.pillAll,
        boxShadow: colors.shadowSoft,
      ),
      child: Row(
        children: [
          const SizedBox(width: 14),
          Icon(Icons.search_rounded, size: 20, color: colors.inkMuted),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: widget.controller,
              onChanged: widget.onChanged,
              style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkStrong),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
                hintText: widget.hint,
                hintStyle: theme.textTheme.bodyMedium?.copyWith(
                  color: colors.inkMuted,
                ),
              ),
            ),
          ),
          if (_hasText)
            IconButton(
              icon: Icon(Icons.close_rounded, size: 18, color: colors.inkMuted),
              visualDensity: VisualDensity.compact,
              onPressed: () {
                widget.controller.clear();
                widget.onChanged('');
              },
            ),
        ],
      ),
    );
  }
}

// ── Circle back button ────────────────────────────────────────────────────────

class _CircleBack extends StatelessWidget {
  const _CircleBack({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.10),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
        ),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Icon(
            isRtl
                ? Icons.arrow_forward_ios_rounded
                : Icons.arrow_back_ios_new_rounded,
            size: 15,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}
