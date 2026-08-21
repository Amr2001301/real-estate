import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  'NEW'         => colors.inkMuted,
  'INTERESTED'  => colors.info,
  'VISIT'       => colors.brandGold,
  'NEGOTIATION' => colors.warning,
  'WON'         => colors.success,
  'LOST'        => colors.error,
  _             => colors.inkMuted,
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
    final l10n      = context.l10n;
    final cubit     = context.read<ClientsCubit>();
    final bottomPad = MediaQuery.of(context).padding.bottom;
    final lang      = Localizations.localeOf(context).languageCode;

    return Scaffold(
      body: Column(
        children: [
          // ── Compact inline header ──────────────────────────────────────────
          _ClientsHeader(title: l10n.navClients),
          // ── Search ────────────────────────────────────────────────────────
          _SearchBar(
            controller: _search,
            hint: l10n.clientsSearchHint,
            onSubmitted: cubit.setSearch,
          ),
          // ── Filter chips ──────────────────────────────────────────────────
          BlocBuilder<ClientsCubit, ClientsListState>(
            buildWhen: (a, b) => a.clients != b.clients,
            builder: (context, state) {
              final all = state.clients;
              final activeCount = all
                  .where(
                    (c) =>
                        c.latestStage == 'INTERESTED' ||
                        c.latestStage == 'VISIT' ||
                        c.latestStage == 'NEGOTIATION',
                  )
                  .length;
              return _FilterRow(
                selected: _filter,
                onSelected: (f) => setState(() => _filter = f),
                lang: lang,
                total: all.length,
                activeCount: activeCount,
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
          // ── Body ──────────────────────────────────────────────────────────
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
                          SliverToBoxAdapter(
                            child: _KpiBar(clients: state.clients, lang: lang),
                          ),
                          if (filtered.isEmpty)
                            SliverFillRemaining(
                              hasScrollBody: false,
                              child: EmptyState(
                                icon: Icons.filter_list_off_rounded,
                                title: lang == 'ar' ? 'لا توجد نتائج' : 'No results',
                                message: lang == 'ar' ? 'جرّب تصفية أخرى' : 'Try a different filter',
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
                                delegate: SliverChildBuilderDelegate(
                                  (context, i) {
                                    if (i.isOdd) {
                                      return const SizedBox(height: AppSpacing.sm);
                                    }
                                    return _ClientCard(client: filtered[i ~/ 2]);
                                  },
                                  childCount: filtered.length * 2 - 1,
                                ),
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

// ── Compact header ─────────────────────────────────────────────────────────────

class _ClientsHeader extends StatelessWidget {
  const _ClientsHeader({required this.title});
  final String title;

  static const _navyDeep  = Color(0xFF0B1726);
  static const _navyMid   = Color(0xFF14273F);
  static const _navyLight = Color(0xFF243F62);

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: _buildContent(),
    );
  }

  Widget _buildContent() {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_navyLight, _navyMid, _navyDeep],
          stops: [0.0, 0.45, 1.0],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(AppRadii.xl + 4),
          bottomRight: Radius.circular(AppRadii.xl + 4),
        ),
        boxShadow: [
          BoxShadow(color: Color(0x33000000), blurRadius: 22, offset: Offset(0, 8)),
        ],
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(AppRadii.xl + 4),
                bottomRight: Radius.circular(AppRadii.xl + 4),
              ),
              child: IgnorePointer(
                child: CustomPaint(painter: _DotsPainter()),
              ),
            ),
          ),
          PositionedDirectional(
            top: 0, end: -30,
            child: Container(
              width: 180, height: 180,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0x1EC8A24B), Color(0x00C8A24B)],
                  stops: [0.0, 0.75],
                ),
              ),
            ),
          ),
          const Positioned(
            bottom: 0, left: 40, right: 40,
            child: SizedBox(
              height: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.transparent, Color(0x80C8A24B), Colors.transparent],
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.md,
                AppSpacing.lg, AppSpacing.lg,
              ),
              child: Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.4,
                  height: 1.15,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DotsPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 8.0; y < size.height; y += step) {
      for (var x = 8.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotsPainter _) => false;
}

// ── Search bar ────────────────────────────────────────────────────────────────

class _SearchBar extends StatefulWidget {
  const _SearchBar({
    required this.controller,
    required this.hint,
    required this.onSubmitted,
  });
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onSubmitted;

  @override
  State<_SearchBar> createState() => _SearchBarState();
}

class _SearchBarState extends State<_SearchBar> {
  final _focus = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() => _focused = _focus.hasFocus));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md, AppSpacing.md,
        AppSpacing.md, AppSpacing.xs,
      ),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(AppRadii.pill),
          border: Border.all(
            color: _focused ? AppPalette.gold400 : colors.hairline.withValues(alpha: 0.6),
            width: _focused ? 1.5 : 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: _focused
                  ? AppPalette.gold400.withValues(alpha: 0.18)
                  : Colors.black.withValues(alpha: 0.06),
              blurRadius: _focused ? 14 : 8,
              offset: const Offset(0, 3),
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 3,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: TextField(
          controller: widget.controller,
          focusNode: _focus,
          textInputAction: TextInputAction.search,
          onSubmitted: widget.onSubmitted,
          style: TextStyle(fontSize: 15, color: colors.inkStrong),
          decoration: InputDecoration(
            hintText: widget.hint,
            hintStyle: TextStyle(fontSize: 15, color: colors.inkMuted),
            prefixIcon: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Icon(
                Icons.search_rounded,
                size: 21,
                color: _focused ? AppPalette.gold400 : colors.inkMuted,
              ),
            ),
            prefixIconConstraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: 13,
            ),
            isDense: true,
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            filled: false,
          ),
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
    final colors = context.appColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(bottom: BorderSide(color: colors.hairline, width: 0.5)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: 10,
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
              dotColor: colors.success,
              active: selected == _Filter.active,
              onTap: () => onSelected(_Filter.active),
            ),
            const SizedBox(width: AppSpacing.xs),
            _FilterChip(
              label: lang == 'ar' ? 'يحتاج متابعة' : 'Follow-up',
              count: followUpCount,
              dotColor: colors.warning,
              active: selected == _Filter.needsFollowUp,
              onTap: () => onSelected(_Filter.needsFollowUp),
            ),
            const SizedBox(width: AppSpacing.xs),
            _FilterChip(
              label: lang == 'ar' ? 'لديه فرصة' : 'Has opp.',
              count: hasOppCount,
              dotColor: colors.info,
              active: selected == _Filter.hasOpportunity,
              onTap: () => onSelected(_Filter.hasOpportunity),
            ),
            const SizedBox(width: AppSpacing.xs),
            _FilterChip(
              label: lang == 'ar' ? 'بدون نشاط' : 'Inactive',
              count: noActivityCount,
              dotColor: colors.inkMuted,
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
          horizontal: AppSpacing.sm + 4,
          vertical: 11,
        ),
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
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
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
                decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
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

// ── KPI stats bar ─────────────────────────────────────────────────────────────

class _KpiBar extends StatelessWidget {
  const _KpiBar({required this.clients, required this.lang});
  final List<StaffClient> clients;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final colors   = context.appColors;
    final total    = clients.length;
    final active   = clients
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
        AppSpacing.md, AppSpacing.sm,
        AppSpacing.md, AppSpacing.xs,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadii.card,
          border: Border.all(color: colors.hairline, width: 0.8),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: IntrinsicHeight(
          child: Row(
            children: [
              Expanded(
                child: _KpiStat(
                  value: '$total',
                  label: lang == 'ar' ? 'إجمالي العملاء' : 'Total',
                  color: colors.brandNavy,
                ),
              ),
              VerticalDivider(width: 1, thickness: 0.8, color: colors.hairline),
              Expanded(
                child: _KpiStat(
                  value: '$active',
                  label: lang == 'ar' ? 'نشطون' : 'Active',
                  color: colors.success,
                ),
              ),
              VerticalDivider(width: 1, thickness: 0.8, color: colors.hairline),
              Expanded(
                child: _KpiStat(
                  value: '$followUp',
                  label: lang == 'ar' ? 'يحتاجون متابعة' : 'Follow-up',
                  color: colors.warning,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _KpiStat extends StatelessWidget {
  const _KpiStat({
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
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: color,
              height: 1.1,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 3),
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

class _ClientCard extends StatefulWidget {
  const _ClientCard({required this.client});
  final StaffClient client;

  @override
  State<_ClientCard> createState() => _ClientCardState();
}

class _ClientCardState extends State<_ClientCard> {
  bool _pressed = false;
  StaffClient get client => widget.client;

  @override
  Widget build(BuildContext context) {
    final l10n       = context.l10n;
    final colors     = context.appColors;
    final isRtl      = context.read<LocaleCubit>().isRtl;
    final stageColor = _stageColor(client.latestStage, colors);
    final initials   = _initials(client.fullName);

    return GestureDetector(
      onTapDown:   (_) => setState(() => _pressed = true),
      onTapUp:     (_) => setState(() => _pressed = false),
      onTapCancel: ()  => setState(() => _pressed = false),
      onTap: () => context.push('/clients/${client.clientId}', extra: client),
      child: AnimatedScale(
        scale:    _pressed ? 0.975 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve:    Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            color:        colors.surface,
            borderRadius: AppRadii.card,
            border:       Border.all(color: stageColor.withValues(alpha: 0.14), width: 0.8),
            boxShadow: [
              BoxShadow(
                color:      stageColor.withValues(alpha: 0.08),
                blurRadius: 18,
                offset:     const Offset(0, 5),
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
            mainAxisSize:       MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top accent strip
              Container(
                height: 3,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin:  isRtl ? Alignment.centerRight : Alignment.centerLeft,
                    end:    isRtl ? Alignment.centerLeft  : Alignment.centerRight,
                    colors: [stageColor, stageColor.withValues(alpha: 0.0)],
                  ),
                ),
              ),
              // Card body
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md, AppSpacing.sm,
                  AppSpacing.md, AppSpacing.sm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Avatar + name/phone + badge + chevron
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Container(
                          width: 44, height: 44,
                          decoration: BoxDecoration(
                            color:  stageColor.withValues(alpha: 0.12),
                            shape:  BoxShape.circle,
                            border: Border.all(color: stageColor.withValues(alpha: 0.30)),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            initials,
                            style: TextStyle(
                              color:      stageColor,
                              fontSize:   15,
                              fontWeight: FontWeight.w700,
                              height:     1,
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
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize:   15,
                                  fontWeight: FontWeight.w700,
                                  color:      colors.inkStrong,
                                  height:     1.2,
                                ),
                              ),
                              if (client.phone != null) ...[
                                const SizedBox(height: 2),
                                Text(
                                  client.phone!,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12, color: colors.inkMuted, height: 1.3),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        StatusBadge(
                          label: leadStageLabel(l10n, client.latestStage),
                          tone:  leadStageTone(client.latestStage),
                        ),
                        const SizedBox(width: AppSpacing.xxs),
                        Icon(Icons.chevron_right_rounded, size: 20, color: colors.inkMuted),
                      ],
                    ),
                    // Opportunity chip + call button
                    const SizedBox(height: 8),
                    Container(height: 0.5, color: colors.hairline),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color:        colors.brandNavy.withValues(alpha: 0.07),
                            border:       Border.all(color: colors.brandNavy.withValues(alpha: 0.18)),
                            borderRadius: AppRadii.pillAll,
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.business_center_outlined,
                                size:  11,
                                color: colors.brandNavy.withValues(alpha: 0.75),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                l10n.salesOpportunityCount(client.leadCount),
                                style: TextStyle(
                                  fontSize:   11,
                                  fontWeight: FontWeight.w600,
                                  color:      colors.brandNavy,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(),
                        if (client.phone != null)
                          GestureDetector(
                            onTap:    () => ContactActions.call(client.phone!),
                            behavior: HitTestBehavior.opaque,
                            child: Container(
                              width: 36, height: 36,
                              decoration: BoxDecoration(
                                color:  colors.success.withValues(alpha: 0.10),
                                border: Border.all(color: colors.success.withValues(alpha: 0.25)),
                                shape:  BoxShape.circle,
                              ),
                              child: Icon(Icons.call_rounded, size: 16, color: colors.success),
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
    );
  }
}
