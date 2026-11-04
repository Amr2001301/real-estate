import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
import '../../../dashboard/home_kit/home_kit.dart';
import '../../domain/entities/lead.dart';
import '../cubit/leads_cubit.dart';

export '../cubit/leads_cubit.dart' show LeadSource;

// ── Helpers ────────────────────────────────────────────────────────────────────

const _stages = ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION', 'WON', 'LOST'];

Color leadStageColor(String stage, AppColorsExt colors) => switch (stage) {
      'NEW' => colors.inkMuted,
      'INTERESTED' => colors.info,
      'VISIT' => colors.brandGold,
      'NEGOTIATION' => colors.warning,
      'WON' => colors.success,
      'LOST' => colors.error,
      _ => colors.inkMuted,
    };

/// «اليوم 3:30 م», «غدًا 11:00 ص», «أمس», or the date.
String leadWhen(BuildContext context, DateTime at, {bool withTime = true, DateTime? now}) {
  final l10n = context.l10n;
  final lang = Localizations.localeOf(context).languageCode;
  final today = homeDay(now ?? DateTime.now());
  final days = homeDay(at).difference(today).inDays;
  final day = switch (days) {
    0 => l10n.lvToday,
    1 => l10n.lvTomorrow,
    -1 => l10n.lvYesterday,
    _ => DateFormatter.dayMonth(at, languageCode: lang),
  };
  return withTime ? '$day ${DateFormatter.time(at, languageCode: lang)}' : day;
}

/// overdue / today / upcoming, as the website's follow-up colours.
enum LeadFollowState { overdue, today, upcoming }

LeadFollowState leadFollowState(DateTime at, DateTime now) {
  if (at.isBefore(now)) return LeadFollowState.overdue;
  if (homeDay(at) == homeDay(now)) return LeadFollowState.today;
  return LeadFollowState.upcoming;
}

/// A call or WhatsApp press: logged on the lead (as on the website), then
/// opened on the phone.
Future<void> leadContact(BuildContext context, Lead lead, String kind) async {
  final cubit = context.read<LeadsCubit>();
  final messenger = ScaffoldMessenger.of(context);
  final noPhone = context.l10n.lvNoPhone;
  final phone = await cubit.openContact(lead.id, kind) ?? lead.phone;
  if (phone == null || phone.isEmpty) {
    messenger.showSnackBar(SnackBar(content: Text(noPhone)));
    return;
  }
  kind == 'WHATSAPP' ? await ContactActions.whatsApp(number: phone) : await ContactActions.call(phone);
}

// ── Screen ────────────────────────────────────────────────────────────────────

/// The leads list (owner-approved look, 2026-11-04), with the figures of the
/// website's leads page: the stage counts for the whole scope, the open
/// leads and the conversion, the queue nobody owns (managers), and on each
/// card the source or broker, the unit, the next follow-up or visit, the
/// last contact, the days in stage and the rep.
class LeadsScreen extends StatefulWidget {
  const LeadsScreen({super.key});

  @override
  State<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends State<LeadsScreen> {
  final _search = TextEditingController();
  final _scrollCtrl = ScrollController();
  late final bool _manager;

  @override
  void initState() {
    super.initState();
    final role = context.read<SessionCubit>().state.role;
    _manager = role == AppRole.admin || role == AppRole.salesManager;
    context.read<LeadsCubit>()
      ..queue = _manager
      ..load();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _search.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
      context.read<LeadsCubit>().loadMore();
    }
  }

  void _showFilterSheet(BuildContext context, LeadsCubit cubit) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LeadFilterSheet(cubit: cubit, manager: _manager),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<LeadsCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    final lang = Localizations.localeOf(context).languageCode;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        floatingActionButton: Padding(
          padding: const EdgeInsets.only(bottom: 84),
          child: FloatingActionButton(
            key: const Key('leads-add'),
            backgroundColor: AppPalette.gold400,
            foregroundColor: AppPalette.navy,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
            onPressed: () async {
              final created = await context.push<bool>('/leads/new');
              if (created == true && context.mounted) cubit.load();
            },
            tooltip: l10n.leadNew,
            child: const Icon(Icons.person_add_rounded),
          ),
        ),
        body: BlocBuilder<LeadsCubit, LeadsListState>(
          builder: (context, state) {
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                controller: _scrollCtrl,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: HomeListHero(
                      title: l10n.navLeads,
                      subtitle: state.pipeline.isEmpty ? null : l10n.lvCountN(state.pipelineTotal),
                      actions: [
                        if (!_manager)
                          HomeHeroButton(
                            icon: Icons.person_rounded,
                            active: state.mine,
                            tooltip: l10n.lvMine,
                            onTap: cubit.toggleMine,
                          )
                        else
                          // Admins and sales managers merge duplicates, as on the website.
                          HomeHeroButton(
                            key: const Key('leads-duplicates'),
                            icon: Icons.content_copy_rounded,
                            tooltip: l10n.duplicatesTitle,
                            onTap: () => context.push('/duplicates'),
                          ),
                        HomeHeroButton(
                          icon: Icons.tune_rounded,
                          dot: state.hasAdvancedFilters,
                          tooltip: l10n.lvFilters,
                          onTap: () => _showFilterSheet(context, cubit),
                        ),
                      ],
                      bottom: HomeSearchField(
                        controller: _search,
                        hint: l10n.leadsSearchHint,
                        onSubmitted: cubit.setSearch,
                        onClear: () {
                          _search.clear();
                          cubit.setSearch('');
                        },
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(child: _Figures(state: state, manager: _manager)),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 12, bottom: 4),
                      child: HomePills(pills: [
                        HomePill(
                          id: 'all',
                          label: l10n.lvAll,
                          count: state.pipeline.isEmpty ? null : state.pipelineTotal,
                          selected: state.stage == null && !state.unassigned,
                          onTap: () => state.unassigned ? cubit.toggleUnassigned() : cubit.setStage(null),
                        ),
                        if (_manager)
                          HomePill(
                            id: 'unassigned',
                            label: l10n.lvUnassigned,
                            count: state.unassignedCount,
                            dot: AppPalette.gold400,
                            selected: state.unassigned,
                            onTap: cubit.toggleUnassigned,
                          ),
                        for (final s in _stages)
                          HomePill(
                            id: s,
                            label: leadStageLabel(l10n, s),
                            count: state.pipeline[s],
                            dot: leadStageColor(s, context.appColors),
                            selected: state.stage == s,
                            onTap: () async {
                              if (state.unassigned) await cubit.toggleUnassigned();
                              await cubit.setStage(state.stage == s ? null : s);
                            },
                          ),
                      ]),
                    ),
                  ),
                  if (state.hasAdvancedFilters)
                    SliverToBoxAdapter(child: _ActiveFilterChips(state: state, cubit: cubit, lang: lang)),
                  ..._body(context, state),
                  if (state.isLoadingMore)
                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                        child: Center(child: CircularProgressIndicator()),
                      ),
                    ),
                  SliverPadding(padding: EdgeInsets.only(bottom: bottomPad + 120)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  List<Widget> _body(BuildContext context, LeadsListState state) {
    final l10n = context.l10n;
    final cubit = context.read<LeadsCubit>();
    switch (state.status) {
      case DataStatus.initial:
      case DataStatus.loading:
        return const [SliverToBoxAdapter(child: SizedBox(height: 600, child: StaffListSkeleton()))];
      case DataStatus.failure:
        return [SliverToBoxAdapter(child: ErrorState(failure: state.failure, onRetry: cubit.load))];
      case DataStatus.empty:
        return [
          SliverToBoxAdapter(
            child: EmptyState(icon: Icons.people_outline_rounded, title: l10n.leadsEmptyTitle, message: l10n.leadsEmptyMessage),
          ),
        ];
      case DataStatus.success:
        return [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, 0),
            sliver: SliverList.separated(
              itemCount: state.leads.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) => LeadCard(lead: state.leads[i], showRep: _manager),
            ),
          ),
        ];
    }
  }
}

/// The navy band: the scope's leads (and how many are open), the conversion,
/// and the unassigned queue (managers) or the overdue follow-ups (reps).
class _Figures extends StatelessWidget {
  const _Figures({required this.state, required this.manager});
  final LeadsListState state;
  final bool manager;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    if (state.pipeline.isEmpty) return const SizedBox(height: 4);
    final rate = state.conversionRate;
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
      child: HomeBand(figures: [
        HomeFigure(id: 'total', value: '${state.pipelineTotal}', label: l10n.lvTotal, hint: l10n.lvOpenN(state.openCount)),
        HomeFigure(
          id: 'conversion',
          value: rate == null ? '—' : '$rate%',
          label: l10n.lvConversion,
          hint: l10n.lvWonN(state.pipeline['WON'] ?? 0),
        ),
        if (manager)
          HomeFigure(
            id: 'unassigned',
            value: '${state.unassignedCount}',
            label: l10n.lvUnassigned,
            hint: l10n.lvUnassignedHint,
            warn: state.unassignedCount > 0,
          )
        else
          HomeFigure(
            id: 'overdue',
            value: '${state.overdueFollowUps}',
            label: l10n.lvOverdue,
            hint: state.overdueFollowUps > 0 ? l10n.lvOverdueSome : l10n.lvOverdueNone,
            warn: state.overdueFollowUps > 0,
          ),
      ]),
    );
  }
}

/// One lead: who, which project and unit, where from, the stage, and what
/// comes next (the follow-up, else the visit, else the last contact), with
/// call and WhatsApp.
class LeadCard extends StatelessWidget {
  const LeadCard({super.key, required this.lead, this.showRep = false});
  final Lead lead;

  /// Managers see whose lead it is.
  final bool showRep;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final now = DateTime.now();
    final stageColor = leadStageColor(lead.stage, colors);
    final project = lead.projectName?.resolve(lang) ?? lead.projectInterest;
    final where = [
      if ((project ?? '').isNotEmpty) project!,
      if ((lead.unitCode ?? '').isNotEmpty) ltr(lead.unitCode!),
    ].join(' · ');
    final source = lead.brokerName != null ? '${l10n.lvBroker} · ${lead.brokerName}' : (lead.sourceName?.resolve(lang) ?? l10n.lvDirect);

    // What comes next: the follow-up, else the booked visit, else the last contact.
    final (IconData nextIcon, String nextText, Color nextColor) = () {
      final f = lead.nextActionAt;
      if (f != null && lead.stage != 'WON' && lead.stage != 'LOST') {
        return switch (leadFollowState(f, now)) {
          LeadFollowState.overdue => (Icons.alarm_rounded, l10n.lvFollowOverdue(leadWhen(context, f)), colors.error),
          LeadFollowState.today => (Icons.alarm_rounded, l10n.lvFollowToday(DateFormatter.time(f, languageCode: lang)), colors.warning),
          LeadFollowState.upcoming => (Icons.event_repeat_rounded, l10n.lvFollowNext(leadWhen(context, f)), AppPalette.gold600),
        };
      }
      if (lead.upcomingVisitAt != null) {
        return (Icons.event_rounded, l10n.lvVisit(leadWhen(context, lead.upcomingVisitAt!)), colors.info);
      }
      if (lead.lastContactAt != null) {
        return (Icons.history_rounded, l10n.lvLastContact(leadWhen(context, lead.lastContactAt!, withTime: false)), colors.inkMuted);
      }
      return (Icons.history_rounded, l10n.lvNoContact, colors.inkMuted);
    }();
    final days = lead.stageChangedAt == null ? null : homeDay(now).difference(homeDay(lead.stageChangedAt!)).inDays;

    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        key: Key('lead-card-${lead.id}'),
        borderRadius: BorderRadius.circular(20),
        onTap: () => context.push('/leads/${lead.id}', extra: lead).then((_) {
          if (context.mounted) context.read<LeadsCubit>().loadSummary();
        }),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: colors.hairline),
          ),
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(14)),
                  child: Text(homeInitials(lead.fullName), style: homeDisplay(14, AppPalette.gold300)),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(
                        child: Text(lead.fullName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                        decoration: BoxDecoration(color: stageColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(99)),
                        child: Text(leadStageLabel(l10n, lead.stage),
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: stageColor)),
                      ),
                    ]),
                    if (where.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Row(children: [
                        Icon(Icons.apartment_rounded, size: 13, color: colors.inkMuted),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(where,
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                        ),
                      ]),
                    ],
                    const SizedBox(height: 6),
                    Wrap(spacing: 6, runSpacing: 4, children: [
                      _Tag(icon: lead.brokerName != null ? Icons.handshake_rounded : Icons.call_received_rounded, text: source),
                      if (showRep)
                        lead.unassigned
                            ? _Tag(icon: Icons.person_off_rounded, text: l10n.lvUnassigned, color: AppPalette.gold600)
                            : _Tag(icon: Icons.person_rounded, text: lead.assignedSalesName!),
                    ]),
                  ]),
                ),
              ]),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
              decoration: BoxDecoration(
                color: colors.surfaceSoft.withValues(alpha: 0.6),
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
                border: Border(top: BorderSide(color: colors.hairline)),
              ),
              child: Row(children: [
                Icon(nextIcon, size: 15, color: nextColor),
                const SizedBox(width: 5),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(nextText,
                        key: Key('lead-next-${lead.id}'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: nextColor)),
                    if (days != null)
                      Text(l10n.lvInStage(days),
                          style: TextStyle(fontSize: 10.5, color: days >= 14 ? colors.warning : colors.inkMuted)),
                  ]),
                ),
                if ((lead.phone ?? '').isNotEmpty) ...[
                  _RoundAction(
                    key: Key('lead-whatsapp-${lead.id}'),
                    icon: Icons.chat_rounded,
                    color: const Color(0xFF1E9E5A),
                    onTap: () => leadContact(context, lead, 'WHATSAPP'),
                  ),
                  const SizedBox(width: 6),
                  _RoundAction(
                    key: Key('lead-call-${lead.id}'),
                    icon: Icons.phone_rounded,
                    color: AppPalette.navy,
                    onTap: () => leadContact(context, lead, 'CALL'),
                  ),
                ],
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.icon, required this.text, this.color});
  final IconData icon;
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.appColors.inkMuted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: context.appColors.surfaceSoft,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 12, color: c),
        const SizedBox(width: 4),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 170),
          child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: c)),
        ),
      ]),
    );
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({super.key, required this.icon, required this.color, required this.onTap});
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: color.withValues(alpha: 0.10),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(width: 36, height: 36, child: Icon(icon, size: 18, color: color)),
        ),
      );
}

/// A choice in the filter sheet.
class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: active ? AppPalette.navy : colors.surface,
      shape: StadiumBorder(side: BorderSide(color: active ? AppPalette.navy : colors.hairline)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Text(label,
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: active ? Colors.white : colors.inkStrong)),
        ),
      ),
    );
  }
}

class _ActiveFilterChips extends StatelessWidget {
  const _ActiveFilterChips({
    required this.state,
    required this.cubit,
    required this.lang,
  });
  final LeadsListState state;
  final LeadsCubit cubit;
  final String lang;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        AppSpacing.xs,
      ),
      child: Row(
        children: [
          // Clear-all chip
          _DismissChip(
            label: l10n.leadsFilterClear,
            icon: Icons.close_rounded,
            onTap: cubit.clearAdvancedFilters,
            colors: colors,
            accent: colors.error,
          ),
          const SizedBox(width: AppSpacing.xs),
          if (state.sourceId != null) ...[
            _DismissChip(
              label: lang == 'ar' ? 'المصدر: …' : 'Source: …',
              onTap: () => cubit.setAdvancedFilters(clearSourceId: true),
              colors: colors,
            ),
            const SizedBox(width: AppSpacing.xs),
          ],
          if (state.salesId != null) ...[
            _DismissChip(
              label: l10n.lvRepChip(state.salesName ?? ''),
              onTap: () => cubit.setSales(null, null),
              colors: colors,
            ),
            const SizedBox(width: AppSpacing.xs),
          ],
          if (state.dateFrom != null) ...[
            _DismissChip(
              label: '${lang == 'ar' ? 'من' : 'From'}: ${state.dateFrom}',
              onTap: () => cubit.setAdvancedFilters(clearDateFrom: true),
              colors: colors,
            ),
            const SizedBox(width: AppSpacing.xs),
          ],
          if (state.dateTo != null)
            _DismissChip(
              label: '${lang == 'ar' ? 'إلى' : 'To'}: ${state.dateTo}',
              onTap: () => cubit.setAdvancedFilters(clearDateTo: true),
              colors: colors,
            ),
        ],
      ),
    );
  }
}

class _DismissChip extends StatelessWidget {
  const _DismissChip({
    required this.label,
    required this.onTap,
    required this.colors,
    this.icon = Icons.cancel_outlined,
    this.accent,
  });
  final String label;
  final VoidCallback onTap;
  final AppColorsExt colors;
  final IconData icon;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final color = accent ?? colors.brandGold;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: 4,
        ),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          border: Border.all(color: color.withValues(alpha: 0.30)),
          borderRadius: AppRadii.pillAll,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
                height: 1.2,
              ),
            ),
            const SizedBox(width: 4),
            Icon(icon, size: 13, color: color),
          ],
        ),
      ),
    );
  }
}

// ── Filter bottom sheet ───────────────────────────────────────────────────────

class _LeadFilterSheet extends StatefulWidget {
  const _LeadFilterSheet({required this.cubit, this.manager = false});
  final LeadsCubit cubit;

  /// Managers and admins also filter by rep.
  final bool manager;

  @override
  State<_LeadFilterSheet> createState() => _LeadFilterSheetState();
}

class _LeadFilterSheetState extends State<_LeadFilterSheet> {
  List<LeadSource> _sources = [];
  bool _loadingSources = true;

  String? _sourceId;
  String? _dateFrom;
  String? _dateTo;
  List<StaffOption> _staff = const [];
  String? _salesId;

  @override
  void initState() {
    super.initState();
    final s = widget.cubit.state;
    _sourceId = s.sourceId;
    _dateFrom = s.dateFrom;
    _dateTo = s.dateTo;
    _salesId = s.salesId;
    _loadSources();
    if (widget.manager) {
      widget.cubit.fetchStaff().then((list) {
        if (mounted) setState(() => _staff = list);
      });
    }
  }

  Future<void> _loadSources() async {
    final sources = await widget.cubit.fetchSources();
    if (mounted) {
      setState(() {
        _sources = sources;
        _loadingSources = false;
      });
    }
  }

  Future<void> _pickDate(bool isFrom) async {
    final initial =
        DateTime.tryParse(isFrom ? (_dateFrom ?? '') : (_dateTo ?? '')) ??
        DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null && mounted) {
      final iso =
          '${picked.year.toString().padLeft(4, '0')}-'
          '${picked.month.toString().padLeft(2, '0')}-'
          '${picked.day.toString().padLeft(2, '0')}';
      setState(() {
        if (isFrom) {
          _dateFrom = iso;
        } else {
          _dateTo = iso;
        }
      });
    }
  }

  void _apply() {
    if (widget.manager && _salesId != widget.cubit.state.salesId) {
      final name = _staff.where((o) => o.id == _salesId).firstOrNull?.name;
      widget.cubit.setSales(_salesId, name);
    }
    widget.cubit.setAdvancedFilters(
      sourceId: _sourceId,
      clearSourceId: _sourceId == null,
      dateFrom: _dateFrom,
      clearDateFrom: _dateFrom == null,
      dateTo: _dateTo,
      clearDateTo: _dateTo == null,
    );
    Navigator.of(context).pop();
  }

  void _clear() {
    setState(() {
      _sourceId = null;
      _dateFrom = null;
      _dateTo = null;
      _salesId = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        bottomPad + AppSpacing.md,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.hairline,
                borderRadius: AppRadii.pillAll,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          // Title row
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.leadsFilterSheet,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: colors.inkStrong,
                  ),
                ),
              ),
              TextButton(
                onPressed: _clear,
                child: Text(
                  l10n.leadsFilterClear,
                  style: TextStyle(color: colors.error, fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // Source picker
          Text(
            l10n.leadsFilterSource,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: colors.inkMuted,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          if (_loadingSources)
            const Center(
              child: SizedBox(
                height: 32,
                width: 32,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _FilterChip(
                    label: lang == 'ar' ? 'الكل' : 'All',
                    active: _sourceId == null,
                    onTap: () => setState(() => _sourceId = null),
                  ),
                  for (final src in _sources) ...[
                    const SizedBox(width: AppSpacing.xs),
                    _FilterChip(
                      label: src.name,
                      active: _sourceId == src.id,
                      onTap: () => setState(
                        () => _sourceId = _sourceId == src.id ? null : src.id,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          const SizedBox(height: AppSpacing.md),

          // Date range
          Text(
            lang == 'ar' ? 'نطاق التاريخ' : 'Date range',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: colors.inkMuted,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: _DateButton(
                  label: _dateFrom ?? l10n.leadsFilterDateFrom,
                  hasValue: _dateFrom != null,
                  onTap: () => _pickDate(true),
                  onClear: _dateFrom != null
                      ? () => setState(() => _dateFrom = null)
                      : null,
                  colors: colors,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _DateButton(
                  label: _dateTo ?? l10n.leadsFilterDateTo,
                  hasValue: _dateTo != null,
                  onTap: () => _pickDate(false),
                  onClear: _dateTo != null
                      ? () => setState(() => _dateTo = null)
                      : null,
                  colors: colors,
                ),
              ),
            ],
          ),
          if (widget.manager && _staff.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              l10n.lvRep,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.inkMuted),
            ),
            const SizedBox(height: AppSpacing.xs),
            SizedBox(
              height: 36,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _FilterChip(
                    label: l10n.lvAllReps,
                    active: _salesId == null,
                    onTap: () => setState(() => _salesId = null),
                  ),
                  for (final o in _staff) ...[
                    const SizedBox(width: AppSpacing.xs),
                    _FilterChip(
                      label: o.name,
                      active: _salesId == o.id,
                      onTap: () => setState(() => _salesId = _salesId == o.id ? null : o.id),
                    ),
                  ],
                ],
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),

          // Apply button
          FilledButton(onPressed: _apply, child: Text(l10n.leadsFilterApply)),
        ],
      ),
    );
  }
}

class _DateButton extends StatelessWidget {
  const _DateButton({
    required this.label,
    required this.hasValue,
    required this.onTap,
    required this.colors,
    this.onClear,
  });
  final String label;
  final bool hasValue;
  final VoidCallback onTap;
  final VoidCallback? onClear;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: 10,
        ),
        decoration: BoxDecoration(
          color: hasValue
              ? colors.brandNavy.withValues(alpha: 0.06)
              : colors.surface,
          border: Border.all(
            color: hasValue
                ? colors.brandNavy.withValues(alpha: 0.25)
                : colors.hairline,
          ),
          borderRadius: AppRadii.card,
        ),
        child: Row(
          children: [
            Icon(
              Icons.calendar_today_outlined,
              size: 14,
              color: hasValue ? colors.brandNavy : colors.inkMuted,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  color: hasValue ? colors.inkStrong : colors.inkMuted,
                  fontWeight: hasValue ? FontWeight.w600 : FontWeight.w400,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (onClear != null)
              GestureDetector(
                onTap: onClear,
                child: Icon(
                  Icons.close_rounded,
                  size: 14,
                  color: colors.inkMuted,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
