import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/lead_stage_label.dart';
import '../../../../common/staff_list_skeleton.dart';
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
    showFilterSheet(context, (_) => _LeadFilterSheet(cubit: cubit, manager: _manager));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<LeadsCubit>();
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    final lang = Localizations.localeOf(context).languageCode;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: Theme.of(context).brightness == Brightness.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: Scaffold(
        body: BlocBuilder<LeadsCubit, LeadsListState>(
          builder: (context, state) {
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: CustomScrollView(
                controller: _scrollCtrl,
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: DvPageTitle(
                      title: l10n.navLeads,
                      overline: state.pipeline.isEmpty ? null : l10n.lvCountN(state.pipelineTotal),
                      trailing: [
                        SizedBox(
                          width: 104,
                          child: DvGoldButton(
                            key: const Key('leads-add'),
                            label: l10n.dvNewLead,
                            icon: Icons.add_rounded,
                            height: 42,
                            onTap: () async {
                              final created = await context.push<bool>('/leads/new');
                              if (created == true && context.mounted) cubit.load();
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                      child: Row(children: [
                        Expanded(
                          child: TextField(
                            key: const Key('leads-search'),
                            controller: _search,
                            textInputAction: TextInputAction.search,
                            onSubmitted: cubit.setSearch,
                            style: const TextStyle(fontSize: 14),
                            decoration: InputDecoration(
                              hintText: l10n.dvSearchLeads,
                              prefixIcon: const Icon(Icons.search_rounded, size: 20),
                              filled: true,
                              fillColor: context.appColors.surface,
                              contentPadding: const EdgeInsets.symmetric(vertical: 12),
                              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: context.appColors.hairline)),
                              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: AppPalette.navy, width: 1.3)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        if (!_manager)
                          DvIconButton(icon: state.mine ? Icons.person_rounded : Icons.person_outline_rounded, dot: state.mine, tooltip: l10n.lvMine, onTap: cubit.toggleMine)
                        else
                          // Admins and sales managers merge duplicates, as on the website.
                          DvIconButton(key: const Key('leads-duplicates'), icon: Icons.content_copy_rounded, tooltip: l10n.duplicatesTitle, onTap: () => context.push('/duplicates')),
                        const SizedBox(width: 10),
                        DvIconButton(
                          key: const Key('leads-filters'),
                          icon: Icons.tune_rounded,
                          dot: state.hasAdvancedFilters,
                          tooltip: l10n.lvFilters,
                          onTap: () => _showFilterSheet(context, cubit),
                        ),
                      ]),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 16, bottom: 4),
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
        return const [SliverToBoxAdapter(child: SizedBox(height: 600, child: StaffListSkeleton(band: true)))];
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
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
            sliver: SliverList.builder(
              itemCount: state.leads.length,
              itemBuilder: (context, i) => LeadCard(
                lead: state.leads[i],
                showRep: _manager,
                first: i == 0,
                last: i == state.leads.length - 1,
              ),
            ),
          ),
        ];
    }
  }
}

/// One lead: who, which project and unit, where from, the stage, and what
/// comes next (the follow-up, else the visit, else the last contact), with
/// call and WhatsApp.
class LeadCard extends StatelessWidget {
  const LeadCard({super.key, required this.lead, this.showRep = false, this.first = true, this.last = true});
  final Lead lead;

  /// Managers see whose lead it is.
  final bool showRep;

  /// The rows share one white card: the first rounds the top, the last the bottom.
  final bool first;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final now = DateTime.now();
    final stageColor = leadStageColor(lead.stage, colors);
    final project = lead.projectName?.resolve(lang) ?? lead.projectInterest;
    final source = lead.brokerName ?? lead.sourceName?.resolve(lang) ?? l10n.lvDirect;
    final rep = showRep ? (lead.unassigned ? l10n.lvUnassigned : lead.assignedSalesName) : null;
    final line = [if ((project ?? '').isNotEmpty) project!, source, if ((rep ?? '').isNotEmpty) rep!].join(' · ');

    // Only what needs attention: an overdue follow-up, or one due today.
    final f = lead.nextActionAt;
    final open = lead.stage != 'WON' && lead.stage != 'LOST';
    final state = f == null || !open ? null : leadFollowState(f, now);
    final (String? due, DvTone tone) = switch (state) {
      LeadFollowState.overdue => (l10n.dvOverdueDays(homeDay(now).difference(homeDay(f!)).inDays), DvTone.bad),
      LeadFollowState.today => (l10n.dvTodayAt(DateFormatter.time(f!, languageCode: lang)), DvTone.warn),
      _ => (null, DvTone.neutral),
    };
    final radius = BorderRadius.vertical(top: Radius.circular(first ? 20 : 0), bottom: Radius.circular(last ? 20 : 0));

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: radius,
        border: Border(
          top: first ? BorderSide(color: colors.hairline) : BorderSide.none,
          left: BorderSide(color: colors.hairline),
          right: BorderSide(color: colors.hairline),
          bottom: BorderSide(color: colors.hairline),
        ),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: radius,
        child: InkWell(
          key: Key('lead-card-${lead.id}'),
          borderRadius: radius,
          onTap: () => context.push('/leads/${lead.id}', extra: lead).then((_) {
            if (context.mounted) context.read<LeadsCubit>().loadSummary();
          }),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
            child: Row(children: [
              Container(
                width: 42,
                height: 42,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: colors.surfaceSoft, shape: BoxShape.circle),
                child: Text(homeInitials(lead.fullName), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.inkStrong)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(lead.fullName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 14.5, height: 1.4, fontWeight: FontWeight.w600, color: colors.inkStrong)),
                  const SizedBox(height: 5),
                  Text(line, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, height: 1.4, color: colors.inkMuted)),
                ]),
              ),
              const SizedBox(width: 10),
              Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(color: stageColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                  child: Text(leadStageLabel(l10n, lead.stage), style: TextStyle(fontSize: 12, height: 1.4, fontWeight: FontWeight.w700, color: stageColor)),
                ),
                if (due != null) ...[
                  const SizedBox(height: 6),
                  Text(due,
                      key: Key('lead-next-${lead.id}'),
                      style: TextStyle(fontSize: 11.5, height: 1.3, fontWeight: FontWeight.w700, color: tone == DvTone.bad ? colors.error : colors.warning)),
                ],
              ]),
              if ((lead.phone ?? '').isNotEmpty) ...[
                const SizedBox(width: 8),
                _RoundAction(
                  key: Key('lead-call-${lead.id}'),
                  icon: Icons.phone_rounded,
                  color: colors.inkStrong,
                  onTap: () => leadContact(context, lead, 'CALL'),
                ),
              ],
            ]),
          ),
        ),
      ),
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
    final lang = Localizations.localeOf(context).languageCode;
    final active = (_sourceId == null ? 0 : 1) + (_dateFrom == null && _dateTo == null ? 0 : 1) + (_salesId == null ? 0 : 1);
    return FilterSheet(
      title: l10n.leadsFilterSheet,
      active: active,
      onClear: _clear,
      onApply: _apply,
      applyLabel: l10n.leadsFilterApply,
      sections: [
        FilterSection(
          icon: Icons.campaign_outlined,
          title: l10n.leadsFilterSource,
          child: _loadingSources
              ? const Padding(padding: EdgeInsets.all(12), child: Center(child: SizedBox(height: 26, width: 26, child: CircularProgressIndicator(strokeWidth: 2))))
              : FilterChips<String?>(
                  keyPrefix: 'lead-source',
                  selected: _sourceId,
                  onSelect: (v) => setState(() => _sourceId = v),
                  options: [
                    FilterOption<String?>(null, lang == 'ar' ? 'الكل' : 'All'),
                    for (final src in _sources) FilterOption<String?>(src.id, src.name),
                  ],
                ),
        ),
        FilterSection(
          icon: Icons.date_range_rounded,
          title: lang == 'ar' ? 'نطاق التاريخ' : 'Date range',
          child: Row(children: [
            Expanded(
              child: _DateButton(
                label: _dateFrom ?? l10n.leadsFilterDateFrom,
                hasValue: _dateFrom != null,
                onTap: () => _pickDate(true),
                onClear: _dateFrom != null ? () => setState(() => _dateFrom = null) : null,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _DateButton(
                label: _dateTo ?? l10n.leadsFilterDateTo,
                hasValue: _dateTo != null,
                onTap: () => _pickDate(false),
                onClear: _dateTo != null ? () => setState(() => _dateTo = null) : null,
              ),
            ),
          ]),
        ),
        if (widget.manager && _staff.isNotEmpty)
          FilterSection(
            icon: Icons.badge_outlined,
            title: l10n.lvRep,
            child: FilterChips<String?>(
              keyPrefix: 'lead-rep',
              selected: _salesId,
              onSelect: (v) => setState(() => _salesId = v),
              options: [
                FilterOption<String?>(null, l10n.lvAllReps),
                for (final o in _staff) FilterOption<String?>(o.id, o.name),
              ],
            ),
          ),
      ],
    );
  }
}

class _DateButton extends StatelessWidget {
  const _DateButton({required this.label, required this.hasValue, required this.onTap, this.onClear});
  final String label;
  final bool hasValue;
  final VoidCallback onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: homeField(context),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15), side: BorderSide(color: hasValue ? AppPalette.navy : homeLine(context), width: hasValue ? 1.4 : 1)),
      child: InkWell(
        borderRadius: BorderRadius.circular(15),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          child: Row(children: [
            Icon(Icons.calendar_today_outlined, size: 16, color: AppPalette.gold600),
            const SizedBox(width: 8),
            Expanded(
              child: Text(label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, fontWeight: hasValue ? FontWeight.w700 : FontWeight.w500, color: hasValue ? colors.inkStrong : colors.inkMuted)),
            ),
            if (onClear != null) GestureDetector(onTap: onClear, child: Icon(Icons.close_rounded, size: 16, color: colors.inkMuted)),
          ]),
        ),
      ),
    );
  }
}
