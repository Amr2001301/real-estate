import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/staff_client.dart';
import '../cubit/clients_cubit.dart';

// ── Helpers ────────────────────────────────────────────────────────────────────

enum _Filter { all, active, needsFollowUp, hasOpportunity, noActivity }

List<StaffClient> _applyFilter(List<StaffClient> clients, _Filter filter) =>
    switch (filter) {
      _Filter.all => clients,
      _Filter.active =>
        clients
            .where(
              (c) =>
                  c.latestStage == 'INTERESTED' ||
                  c.latestStage == 'VISIT' ||
                  c.latestStage == 'NEGOTIATION',
            )
            .toList(),
      _Filter.needsFollowUp =>
        clients.where((c) => c.latestStage == 'NEW').toList(),
      _Filter.hasOpportunity => clients.where((c) => c.leadCount > 1).toList(),
      _Filter.noActivity =>
        clients
            .where((c) => c.latestStage == 'LOST' || c.latestStage == 'WON')
            .toList(),
    };

Color _stageColor(String stage, AppColorsExt colors) => switch (stage) {
  'NEW' => colors.inkMuted,
  'INTERESTED' => colors.info,
  'VISIT' => colors.brandGold,
  'NEGOTIATION' => colors.warning,
  'WON' => colors.success,
  'LOST' => colors.error,
  _ => colors.inkMuted,
};

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  final a = parts.first.characters.firstOrNull ?? '?';
  if (parts.length >= 2) {
    final b = parts.last.characters.firstOrNull ?? '';
    return '$a$b'.toUpperCase();
  }
  return a.toUpperCase();
}

// ── Screen ────────────────────────────────────────────────────────────────────

class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen> {
  final _search = TextEditingController();
  _Filter _filter = _Filter.all;

  @override
  void initState() {
    super.initState();
    context.read<ClientsCubit>().load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<ClientsCubit>();
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final lang = Localizations.localeOf(context).languageCode;

    return Scaffold(
      body: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────────────
          AppNavHeader(title: l10n.navClients, subtitle: l10n.clientsSubtitle),
          // ── Search ──────────────────────────────────────────────────────────
          _SearchBar(
            controller: _search,
            hint: l10n.clientsSearchHint,
            onSubmitted: cubit.setSearch,
          ),
          // ── Filter chips ────────────────────────────────────────────────────
          BlocBuilder<ClientsCubit, ClientsListState>(
            buildWhen: (a, b) => a.clients != b.clients,
            builder: (context, state) {
              final all = state.clients;
              return _FilterRow(
                selected: _filter,
                onSelected: (f) => setState(() => _filter = f),
                lang: lang,
                total: all.length,
                activeCount: all
                    .where(
                      (c) =>
                          c.latestStage == 'INTERESTED' ||
                          c.latestStage == 'VISIT' ||
                          c.latestStage == 'NEGOTIATION',
                    )
                    .length,
                followUpCount: all.where((c) => c.latestStage == 'NEW').length,
                hasOppCount: all.where((c) => c.leadCount > 1).length,
                noActivityCount: all
                    .where(
                      (c) => c.latestStage == 'LOST' || c.latestStage == 'WON',
                    )
                    .length,
              );
            },
          ),
          // ── Body ────────────────────────────────────────────────────────────
          Expanded(
            child: BlocBuilder<ClientsCubit, ClientsListState>(
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: cubit.load,
                    );
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.contacts_outlined,
                      title: l10n.clientsEmptyTitle,
                      message: l10n.clientsEmptyMessage,
                    );
                  case DataStatus.success:
                    final filtered = _applyFilter(state.clients, _filter);
                    return RefreshIndicator(
                      onRefresh: cubit.load,
                      child: CustomScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        slivers: [
                          // KPI row
                          SliverToBoxAdapter(
                            child: _KpiRow(clients: state.clients, lang: lang),
                          ),
                          if (filtered.isEmpty)
                            SliverFillRemaining(
                              hasScrollBody: false,
                              child: EmptyState(
                                icon: Icons.filter_list_off_rounded,
                                title: lang == 'ar'
                                    ? 'لا توجد نتائج'
                                    : 'No results',
                                message: lang == 'ar'
                                    ? 'جرّب تصفية أخرى'
                                    : 'Try a different filter',
                              ),
                            )
                          else
                            SliverPadding(
                              padding: EdgeInsets.fromLTRB(
                                AppSpacing.md,
                                AppSpacing.xs,
                                AppSpacing.md,
                                bottomPad + 100,
                              ),
                              sliver: SliverList(
                                delegate: SliverChildBuilderDelegate((
                                  context,
                                  i,
                                ) {
                                  if (i.isOdd) {
                                    return const SizedBox(
                                      height: AppSpacing.sm,
                                    );
                                  }
                                  return _ClientCard(client: filtered[i ~/ 2]);
                                }, childCount: filtered.length * 2 - 1),
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
    );
  }
}

// ── Search bar ────────────────────────────────────────────────────────────────

class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.controller,
    required this.hint,
    required this.onSubmitted,
  });
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onSubmitted;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.xs,
      ),
      child: TextField(
        controller: controller,
        textInputAction: TextInputAction.search,
        onSubmitted: onSubmitted,
        style: TextStyle(fontSize: 15, color: colors.inkStrong),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(fontSize: 15, color: colors.inkMuted),
          prefixIcon: Icon(
            Icons.search_rounded,
            size: 20,
            color: colors.inkMuted,
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 12,
          ),
          isDense: true,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            borderSide: BorderSide(color: colors.hairline),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            borderSide: BorderSide(color: colors.hairline),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            borderSide: const BorderSide(color: AppPalette.gold400, width: 1.5),
          ),
          filled: true,
          fillColor: colors.surface,
        ),
      ),
    );
  }
}

// ── Filter chips row ──────────────────────────────────────────────────────────

class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.selected,
    required this.onSelected,
    required this.lang,
    required this.total,
    required this.activeCount,
    required this.followUpCount,
    required this.hasOppCount,
    required this.noActivityCount,
  });

  final _Filter selected;
  final ValueChanged<_Filter> onSelected;
  final String lang;
  final int total, activeCount, followUpCount, hasOppCount, noActivityCount;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 2,
        ),
        child: Row(
          children: [
            _FilterChip(
              label: lang == 'ar' ? 'الكل' : 'All',
              count: total,
              active: selected == _Filter.all,
              onTap: () => onSelected(_Filter.all),
            ),
            const SizedBox(width: AppSpacing.xs),
            _FilterChip(
              label: lang == 'ar' ? 'نشط' : 'Active',
              count: activeCount,
              active: selected == _Filter.active,
              onTap: () => onSelected(_Filter.active),
            ),
            const SizedBox(width: AppSpacing.xs),
            _FilterChip(
              label: lang == 'ar' ? 'يحتاج متابعة' : 'Follow-up',
              count: followUpCount,
              active: selected == _Filter.needsFollowUp,
              onTap: () => onSelected(_Filter.needsFollowUp),
            ),
            const SizedBox(width: AppSpacing.xs),
            _FilterChip(
              label: lang == 'ar' ? 'لديه فرصة' : 'Has opp.',
              count: hasOppCount,
              active: selected == _Filter.hasOpportunity,
              onTap: () => onSelected(_Filter.hasOpportunity),
            ),
            const SizedBox(width: AppSpacing.xs),
            _FilterChip(
              label: lang == 'ar' ? 'بدون نشاط' : 'Inactive',
              count: noActivityCount,
              active: selected == _Filter.noActivity,
              onTap: () => onSelected(_Filter.noActivity),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.count,
    required this.active,
    required this.onTap,
  });
  final String label;
  final int count;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: 4,
        ),
        decoration: BoxDecoration(
          color: active ? colors.brandNavy : colors.surface,
          border: Border.all(
            color: active ? colors.brandNavy : colors.hairline,
          ),
          borderRadius: AppRadii.pillAll,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active ? Colors.white : colors.inkStrong,
                height: 1.2,
              ),
            ),
            if (count > 0) ...[
              const SizedBox(width: 5),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: active
                      ? Colors.white.withValues(alpha: 0.22)
                      : colors.brandGold.withValues(alpha: 0.14),
                  borderRadius: AppRadii.pillAll,
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: active ? Colors.white : colors.brandGold,
                    height: 1.1,
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

// ── KPI summary row ───────────────────────────────────────────────────────────

class _KpiRow extends StatelessWidget {
  const _KpiRow({required this.clients, required this.lang});
  final List<StaffClient> clients;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final total = clients.length;
    final active = clients
        .where(
          (c) =>
              c.latestStage == 'INTERESTED' ||
              c.latestStage == 'VISIT' ||
              c.latestStage == 'NEGOTIATION',
        )
        .length;
    final followUp = clients.where((c) => c.latestStage == 'NEW').length;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.xs,
      ),
      child: Row(
        children: [
          Expanded(
            child: _KpiCard(
              value: '$total',
              label: lang == 'ar' ? 'إجمالي العملاء' : 'Total',
              color: colors.brandNavy,
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: _KpiCard(
              value: '$active',
              label: lang == 'ar' ? 'نشطون' : 'Active',
              color: colors.success,
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: _KpiCard(
              value: '$followUp',
              label: lang == 'ar' ? 'يحتاجون متابعة' : 'Follow-up',
              color: colors.warning,
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.value,
    required this.label,
    required this.color,
  });
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        border: Border.all(color: color.withValues(alpha: 0.18)),
        borderRadius: AppRadii.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: color,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: colors.inkMuted,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Client card ───────────────────────────────────────────────────────────────

class _ClientCard extends StatelessWidget {
  const _ClientCard({required this.client});
  final StaffClient client;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final stageColor = _stageColor(client.latestStage, colors);
    final initials = _initials(client.fullName);

    return Container(
      decoration: BoxDecoration(
        borderRadius: AppRadii.card,
        boxShadow: colors.shadowCard,
      ),
      child: ClipRRect(
        borderRadius: AppRadii.card,
        child: Material(
          color: colors.surface,
          child: InkWell(
            onTap: () =>
                context.push('/clients/${client.clientId}', extra: client),
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: colors.hairline, width: 0.5),
                borderRadius: AppRadii.card,
              ),
              child: Stack(
                children: [
                  // Colored start-side indicator — thinner for clients (3px)
                  PositionedDirectional(
                    top: 0,
                    bottom: 0,
                    start: 0,
                    child: Container(width: 3, color: stageColor),
                  ),
                  // Main content
                  Padding(
                    padding: const EdgeInsetsDirectional.fromSTEB(
                      AppSpacing.md,
                      12,
                      AppSpacing.md,
                      12,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Row 1: avatar + name/phone + badge + chevron ────
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // Avatar — RTL index 0 = right side
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: stageColor.withValues(alpha: 0.12),
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: stageColor.withValues(alpha: 0.28),
                                ),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                initials,
                                style: TextStyle(
                                  color: stageColor,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  height: 1,
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            // Name + phone
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    client.fullName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                      color: colors.inkStrong,
                                      height: 1.2,
                                    ),
                                  ),
                                  if (client.phone != null) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      client.phone!,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: colors.inkMuted,
                                        height: 1.3,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            // Stage badge
                            StatusBadge(
                              label: leadStageLabel(l10n, client.latestStage),
                              tone: leadStageTone(client.latestStage),
                            ),
                            const SizedBox(width: AppSpacing.xxs),
                            // chevron_right auto-mirrors to ‹ in RTL
                            Icon(
                              Icons.chevron_right_rounded,
                              size: 20,
                              color: colors.inkMuted,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        // Divider
                        Container(height: 0.5, color: colors.hairline),
                        const SizedBox(height: 6),
                        // ── Row 2: opportunity chip + call button ───────────
                        Row(
                          children: [
                            // Opportunity count chip — RTL index 0 = right
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.xs,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: colors.brandNavy.withValues(alpha: 0.06),
                                border: Border.all(
                                  color: colors.brandNavy.withValues(
                                    alpha: 0.14,
                                  ),
                                ),
                                borderRadius: AppRadii.pillAll,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.business_center_outlined,
                                    size: 11,
                                    color: colors.brandNavy.withValues(
                                      alpha: 0.65,
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.xxs),
                                  Text(
                                    l10n.salesOpportunityCount(
                                      client.leadCount,
                                    ),
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: colors.brandNavy,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Spacer(),
                            // Call button — RTL last = left side
                            if (client.phone != null)
                              GestureDetector(
                                onTap: () => ContactActions.call(client.phone!),
                                behavior: HitTestBehavior.opaque,
                                child: Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: colors.success.withValues(
                                      alpha: 0.10,
                                    ),
                                    border: Border.all(
                                      color: colors.success.withValues(
                                        alpha: 0.25,
                                      ),
                                    ),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    Icons.call_rounded,
                                    size: 16,
                                    color: colors.success,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
