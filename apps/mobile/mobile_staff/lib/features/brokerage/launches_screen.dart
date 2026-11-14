import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../common/staff_list_skeleton.dart';
import 'brokerage_data.dart';
import 'brokerage_kit.dart';

/// «الإطلاقات» — developers' launches the brokerage collects expressions of
/// interest (EOIs) for: the launch day, the refundable amount, how many
/// asked, paid and were allocated, and the money held.
class BxLaunchesScreen extends StatefulWidget {
  const BxLaunchesScreen({super.key, required this.repository});
  final BrokerageRepository repository;

  @override
  State<BxLaunchesScreen> createState() => _BxLaunchesScreenState();
}

class _BxLaunchesScreenState extends State<BxLaunchesScreen> {
  List<BxLaunch>? _rows;
  String? _status;
  AppFailure? _failure;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failure = null;
    });
    final r = await widget.repository.launches(Localizations.localeOf(context).languageCode);
    if (!mounted) return;
    setState(() {
      _loading = false;
      switch (r) {
        case Ok(data: final v):
          _rows = v;
        case Err(failure: final f):
          _failure = f;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final all = _rows ?? const <BxLaunch>[];
    final shown = _status == null ? all : all.where((l) => l.status == _status).toList();
    int count(String s) => all.where((l) => l.status == s).length;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('bx-launches'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24),
            children: [
              HomeListHero(back: true, title: l10n.bxLaunchesTitle, subtitle: _rows == null ? null : l10n.bxLaunchesCount(all.length)),
              if (all.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: HomePills(pills: [
                    HomePill(id: 'all', label: l10n.bxAll, count: all.length, selected: _status == null, onTap: () => setState(() => _status = null)),
                    for (final s in kLaunchStatuses)
                      HomePill(id: s, label: bxLaunchStatus(l10n, s), count: count(s), selected: _status == s, onTap: () => setState(() => _status = s)),
                  ]),
                ),
              if (_loading && _rows == null)
                const SizedBox(height: 520, child: StaffListSkeleton())
              else if (_failure != null && _rows == null)
                ErrorState(failure: _failure, onRetry: _load)
              else if (shown.isEmpty)
                EmptyState(icon: Icons.rocket_launch_outlined, title: l10n.bxLaunchesEmpty, message: l10n.bxLaunchesEmptyHint)
              else
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                  child: Column(children: [
                    for (final x in shown) ...[
                      BxLaunchCard(launch: x, onTap: () => context.push('/bx/launches/${x.id}', extra: x)),
                      const SizedBox(height: 10),
                    ],
                  ]),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class BxLaunchCard extends StatelessWidget {
  const BxLaunchCard({super.key, required this.launch, required this.onTap});
  final BxLaunch launch;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final x = launch;
    final tone = bxLaunchColor(x.status, colors);
    return BxCard(
      key: ValueKey('bx-launch-${x.id}'),
      onTap: onTap,
      footer: Row(children: [
        Expanded(
          child: Text(
            [l10n.bxPaidN(x.paid), l10n.bxPendingN(x.pending), l10n.bxAllocatedN(x.allocated)].join(' · '),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12, color: colors.inkMuted),
          ),
        ),
        Icon(Icons.chevron_right_rounded, size: 18, color: colors.inkMuted),
      ]),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        BxIconTile(Icons.rocket_launch_rounded, tone),
        const SizedBox(width: 11),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(x.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong, height: 1.3)),
            const SizedBox(height: 2),
            Text(
              [x.developerName, if (x.projectName != null && x.projectName != x.name) x.projectName!].join(' · '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, color: colors.inkMuted),
            ),
            const SizedBox(height: 7),
            Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
              CatalogBadge.status(bxLaunchStatus(l10n, x.status), tone),
              if (x.launchDate != null) Text(l10n.bxLaunchOn(bxDate(context, x.launchDate)), style: TextStyle(fontSize: 12, color: colors.ink)),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: _Fig(label: l10n.bxEoiAmount, child: BxAmount(x.eoiAmount, size: 14))),
              Expanded(child: _Fig(label: l10n.bxEois, child: Text(ltr('${x.total}'), style: homeDisplay(14, colors.inkStrong)))),
              Expanded(child: _Fig(label: l10n.bxHeld, child: BxAmount(x.held, size: 14))),
            ]),
          ]),
        ),
      ]),
    );
  }
}

class _Fig extends StatelessWidget {
  const _Fig({required this.label, required this.child});
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: context.appColors.inkMuted)),
        FittedBox(fit: BoxFit.scaleDown, alignment: AlignmentDirectional.centerStart, child: child),
      ]);
}

/// One launch: its facts, then the EOIs the caller may see — the paid ones
/// numbered by their place in the queue, then the rest.
class BxLaunchScreen extends StatefulWidget {
  const BxLaunchScreen({super.key, required this.repository, required this.id, this.row});
  final BrokerageRepository repository;
  final String id;
  final BxLaunch? row;

  @override
  State<BxLaunchScreen> createState() => _BxLaunchScreenState();
}

class _BxLaunchScreenState extends State<BxLaunchScreen> {
  late BxLaunch? _x = widget.row;
  bool _full = false;
  AppFailure? _failure;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final r = await widget.repository.launch(widget.id, Localizations.localeOf(context).languageCode);
    if (!mounted) return;
    setState(() {
      switch (r) {
        case Ok(data: final v):
          _x = v;
          _full = true;
          _failure = null;
        case Err(failure: final f):
          _failure = f;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final x = _x;
    // The queue first (by place), then the rest as the API sends them.
    final eois = [...?x?.eois]..sort((a, b) {
        final qa = a.queue, qb = b.queue;
        if (qa != null && qb != null) return qa.compareTo(qb);
        if (qa != null) return -1;
        if (qb != null) return 1;
        return 0;
      });
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('bx-launch'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 24),
            children: [
              HomeListHero(back: true, title: x?.name ?? l10n.bxLaunchesTitle, subtitle: x?.developerName),
              if (x == null && _failure != null)
                ErrorState(failure: _failure, onRetry: _load)
              else if (x == null)
                const SizedBox(height: 420, child: StaffListSkeleton(rows: 3))
              else ...[
                HomeSection(
                  icon: Icons.fact_check_outlined,
                  title: l10n.bxFacts,
                  child: BxFacts(rows: [
                    BxFactRow(l10n.bxStatus, bxLaunchStatus(l10n, x.status), valueColor: bxLaunchColor(x.status, colors), strong: true),
                    if (x.launchDate != null) BxFactRow(l10n.bxLaunchDate, bxDate(context, x.launchDate)),
                    BxFactRow(l10n.bxDeveloper, x.developerName),
                    if (x.projectName != null) BxFactRow(l10n.bxProject, x.projectName!),
                    BxFactRow(l10n.bxEoiAmount, '${bxMoney(x.eoiAmount)} ${bxCurrency(context)}'),
                    if (_full) BxFactRow(l10n.bxQueue, ltr('${x.queueLength}')),
                    if (x.notes != null) BxFactRow(l10n.bxNotes, x.notes!),
                  ]),
                ),
                HomeSection(
                  icon: Icons.format_list_numbered_rounded,
                  title: l10n.bxEois,
                  child: !_full
                      ? const SizedBox(height: 200, child: StaffListSkeleton(rows: 2))
                      : eois.isEmpty
                          ? Container(
                              padding: const EdgeInsets.all(16),
                              decoration: homeCard(context),
                              child: Text(l10n.bxEoisEmpty, textAlign: TextAlign.center, style: TextStyle(color: colors.inkMuted)),
                            )
                          : Column(children: [
                              for (final e in eois) ...[_EoiCard(eoi: e), const SizedBox(height: 8)],
                            ]),
                ),
                const BxWebNote(),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _EoiCard extends StatelessWidget {
  const _EoiCard({required this.eoi});
  final BxEoi eoi;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final e = eoi;
    final tone = bxEoiColor(e.status, colors);
    final facts = [
      if (e.preference != null) '${l10n.bxPreference}: ${e.preference}',
      if (e.budget != null) '${l10n.bxBudget}: ${bxMoney(e.budget!)} ${bxCurrency(context)}',
      if (e.allocation != null) '${l10n.bxAllocation}: ${e.allocation}',
      if (e.paymentRef != null) '${l10n.bxPaymentRef}: ${ltr(e.paymentRef!)}',
    ];
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: homeCard(context, radius: 18),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: e.queue != null ? homeGoldGradient : null,
            color: e.queue != null ? null : tone.withValues(alpha: 0.13),
            borderRadius: BorderRadius.circular(13),
          ),
          child: e.queue != null
              ? Text(ltr(l10n.bxQueueN(e.queue!)), style: homeDisplay(14, AppPalette.navy))
              : Icon(Icons.person_rounded, size: 20, color: tone),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(e.customerName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: colors.inkStrong))),
              BxAmount(e.amount, size: 14),
            ]),
            Text(
              [ltr(e.customerPhone), if (e.agentName != null) e.agentName!].join(' · '),
              style: TextStyle(fontSize: 12, color: colors.inkMuted),
            ),
            for (final f in facts) Padding(padding: const EdgeInsets.only(top: 3), child: Text(f, style: TextStyle(fontSize: 12, color: colors.ink))),
            const SizedBox(height: 6),
            Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
              CatalogBadge.status(bxEoiStatus(l10n, e.status), tone),
              if (e.paidAt != null) Text(l10n.bxPaidOn(bxDate(context, e.paidAt)), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
            ]),
          ]),
        ),
      ]),
    );
  }
}
