import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;

import '../../common/staff_list_skeleton.dart';
import '../leads/presentation/screens/leads_screen.dart' show leadWhen;

/// What the customers and visitors asked through the apps and the website —
/// the website's «استفسارات العملاء» (`/info-requests`): who asked, what, about
/// which project or unit, and its state (open → replied → closed).

/// One inquiry.
class InquiryRow extends Equatable {
  const InquiryRow({
    required this.id,
    required this.message,
    required this.status,
    required this.name,
    required this.kind,
    this.phone,
    this.email,
    this.project,
    this.unitCode,
    this.createdAt,
  });

  final String id;
  final String message;

  /// OPEN, RESPONDED or CLOSED.
  final String status;
  final String name;

  /// visitor (no account), owner (a unit owner) or browser (a client account).
  final String kind;
  final String? phone;
  final String? email;
  final Translatable? project;
  final String? unitCode;
  final DateTime? createdAt;

  factory InquiryRow.fromJson(Map<String, dynamic> j) {
    final user = j['user'] as Map<String, dynamic>?;
    final lead = j['lead'] as Map<String, dynamic>?;
    final role = user?['role'] as String?;
    return InquiryRow(
      id: j['id'] as String? ?? '',
      message: j['message'] as String? ?? '',
      status: j['status'] as String? ?? 'OPEN',
      name: (user?['fullName'] ?? lead?['fullName'] ?? '') as String,
      kind: user == null ? 'visitor' : (role == 'CUSTOMER' ? 'owner' : 'browser'),
      phone: (user?['phone'] ?? lead?['phone']) as String?,
      email: (user?['email'] ?? lead?['email']) as String?,
      project: switch ((j['project'] as Map?)?['name']) {
        final Object n => Translatable.fromJson(n),
        _ => null,
      },
      unitCode: (j['unit'] as Map?)?['code'] as String?,
      createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '')?.toLocal(),
    );
  }

  InquiryRow withStatus(String s) => InquiryRow(
        id: id,
        message: message,
        status: s,
        name: name,
        kind: kind,
        phone: phone,
        email: email,
        project: project,
        unitCode: unitCode,
        createdAt: createdAt,
      );

  @override
  List<Object?> get props => [id, message, status, name, kind, phone, email, project, unitCode, createdAt];
}

class InquiryCounts extends Equatable {
  const InquiryCounts({this.open = 0, this.replied = 0, this.closed = 0});
  final int open;
  final int replied;
  final int closed;
  int get total => open + replied + closed;

  @override
  List<Object?> get props => [open, replied, closed];
}

class InquiriesRepository {
  InquiriesRepository(this._dio);
  final Dio _dio;

  Future<Result<Paginated<InquiryRow>>> list({String? status, int page = 1}) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/info-requests', queryParameters: {
          'page': page,
          'pageSize': 20,
          'status': ?status,
        });
        return Paginated.fromJson(res.data ?? const {}, InquiryRow.fromJson);
      });

  /// The per-state counts, computed on the server over every inquiry.
  Future<Result<InquiryCounts>> counts() => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/info-requests', queryParameters: {'pageSize': 1});
        final c = (((res.data?['meta'] as Map?)?['facets'] as Map?)?['counts'] as Map?)?['status'] as Map? ?? const {};
        int n(String k) => (c[k] as num?)?.toInt() ?? 0;
        return InquiryCounts(open: n('OPEN'), replied: n('RESPONDED'), closed: n('CLOSED'));
      });

  Future<Result<void>> setStatus(String id, String status) =>
      guardApiCall(() async => _dio.patch<void>('/info-requests/$id', data: {'status': status}));
}

String inquiryStatusLabel(AppLocalizations l10n, String s) => switch (s) {
      'RESPONDED' => l10n.inqStatusReplied,
      'CLOSED' => l10n.inqStatusClosed,
      _ => l10n.inqStatusOpen,
    };

Color inquiryStatusColor(String s, AppColorsExt c) => switch (s) {
      'RESPONDED' => c.info,
      'CLOSED' => c.inkMuted,
      _ => c.warning,
    };

class InquiriesScreen extends StatefulWidget {
  const InquiriesScreen({super.key, required this.repository, this.canAct = true});
  final InquiriesRepository repository;

  /// Replying and closing need the same code as the visit requests.
  final bool canAct;

  @override
  State<InquiriesScreen> createState() => _InquiriesScreenState();
}

class _InquiriesScreenState extends State<InquiriesScreen> {
  final _scroll = ScrollController();
  List<InquiryRow> _rows = const [];
  InquiryCounts? _counts;
  String? _filter;
  int _page = 1;
  bool _more = false;
  bool _loading = true;
  bool _loadingMore = false;
  AppFailure? _failure;

  @override
  void initState() {
    super.initState();
    _load();
    _scroll.addListener(() {
      if (_more && !_loadingMore && _scroll.position.pixels >= _scroll.position.maxScrollExtent - 200) _loadMore();
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _rows.isEmpty;
      _failure = null;
    });
    final results = await Future.wait([widget.repository.list(status: _filter), widget.repository.counts()]);
    if (!mounted) return;
    final page = results[0] as Result<Paginated<InquiryRow>>;
    setState(() {
      _loading = false;
      _counts = (results[1] as Result<InquiryCounts>).dataOrNull ?? _counts;
      switch (page) {
        case Ok(data: final value):
          _rows = value.data;
          _more = value.hasMore;
          _page = 1;
        case Err(failure: final failure):
          _failure = failure;
      }
    });
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    final r = await widget.repository.list(status: _filter, page: _page + 1);
    if (!mounted) return;
    setState(() {
      _loadingMore = false;
      if (r case Ok(data: final value)) {
        _rows = [..._rows, ...value.data];
        _more = value.hasMore;
        _page++;
      }
    });
  }

  Future<void> _set(InquiryRow row, String status) async {
    final r = await widget.repository.setStatus(row.id, status);
    if (!mounted) return;
    if (r is Err) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.l10n.inqActionFailed)));
      return;
    }
    await _load();
  }

  void _filters() => showFilterSheet(
        context,
        (_) => _StatusSheet(
          selected: _filter,
          onApply: (v) {
            _filter = v;
            _load();
          },
        ),
      );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final c = _counts;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('inquiries'),
            controller: _scroll,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 100),
            children: [
              HomeListHero(
                back: true,
                title: l10n.inqTitle,
                subtitle: c == null ? null : l10n.inqCountN(c.total),
                actions: [
                  HomeHeroButton(
                    key: const Key('inquiries-filters'),
                    icon: Icons.tune_rounded,
                    dot: _filter != null,
                    tooltip: l10n.inqFilterTitle,
                    onTap: _filters,
                  ),
                ],
              ),
              if (c != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 4),
                  child: HomeBand(figures: [
                    HomeFigure(id: 'open', value: '${c.open}', label: l10n.inqStatusOpen, hint: c.open > 0 ? l10n.inqOpenHint : l10n.inqAllAnswered, warn: c.open > 0),
                    HomeFigure(id: 'replied', value: '${c.replied}', label: l10n.inqStatusReplied, hint: l10n.inqRepliedHint),
                    HomeFigure(id: 'closed', value: '${c.closed}', label: l10n.inqStatusClosed, hint: l10n.inqClosedHint),
                  ]),
                ),
              if (_loading)
                const SizedBox(height: 480, child: StaffListSkeleton())
              else if (_failure != null)
                ErrorState(failure: _failure, onRetry: _load)
              else if (_rows.isEmpty)
                EmptyState(icon: Icons.question_answer_outlined, title: l10n.inqTitle, message: l10n.inqEmpty)
              else
                for (final r in _rows)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.md, 10, AppSpacing.md, 0),
                    child: _InquiryCard(row: r, canAct: widget.canAct, onSet: (s) => _set(r, s)),
                  ),
              if (_loadingMore) const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator())),
            ],
          ),
        ),
      ),
    );
  }
}

class _InquiryCard extends StatelessWidget {
  const _InquiryCard({required this.row, required this.canAct, required this.onSet});
  final InquiryRow row;
  final bool canAct;
  final ValueChanged<String> onSet;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final statusColor = inquiryStatusColor(row.status, colors);
    final (kindLabel, kindColor) = switch (row.kind) {
      'owner' => (l10n.inqOwner, colors.success),
      'browser' => (l10n.inqBrowser, colors.info),
      _ => (l10n.inqVisitor, colors.inkMuted),
    };
    final about = [
      if (row.project != null) row.project!.resolve(lang),
      if (row.unitCode != null) ltr(row.unitCode!),
    ].join(' · ');
    final phone = row.phone ?? '';
    return Container(
      key: Key('inquiry-${row.id}'),
      padding: const EdgeInsets.all(14),
      decoration: homeCard(context, radius: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
            child: Icon(Icons.question_answer_rounded, size: 21, color: statusColor),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(row.name.isEmpty ? l10n.inqNoName : row.name,
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
              const SizedBox(height: 3),
              Row(children: [
                _Pill(kindLabel, kindColor),
                if (row.createdAt != null) ...[
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(leadWhen(context, row.createdAt!), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                  ),
                ],
              ]),
            ]),
          ),
          _Pill(inquiryStatusLabel(l10n, row.status), statusColor),
        ]),
        const SizedBox(height: 11),
        Text(row.message, style: TextStyle(fontSize: 13.5, height: 1.5, color: colors.ink)),
        if (about.isNotEmpty) ...[
          const SizedBox(height: 9),
          Row(children: [
            Icon(Icons.apartment_rounded, size: 15, color: colors.inkMuted),
            const SizedBox(width: 6),
            Expanded(child: Text(about, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.inkMuted))),
          ]),
        ],
        if (phone.isNotEmpty || (canAct && row.status != 'CLOSED')) ...[
          const SizedBox(height: 12),
          Row(children: [
            if (canAct && row.status == 'OPEN')
              Expanded(
                child: _Primary(
                  key: Key('inquiry-replied-${row.id}'),
                  icon: Icons.mark_chat_read_rounded,
                  label: l10n.inqMarkReplied,
                  onTap: () => onSet('RESPONDED'),
                ),
              )
            else
              const Spacer(),
            if (phone.isNotEmpty) ...[
              const SizedBox(width: 8),
              _Act(key: Key('inquiry-call-${row.id}'), icon: Icons.phone_rounded, tooltip: l10n.contactCall, onTap: () => ContactActions.call(phone)),
              const SizedBox(width: 8),
              _Act(
                  key: Key('inquiry-wa-${row.id}'),
                  icon: Icons.chat_rounded,
                  tooltip: l10n.contactWhatsapp,
                  onTap: () => ContactActions.whatsApp(number: phone)),
            ],
            if (canAct && row.status != 'CLOSED') ...[
              const SizedBox(width: 8),
              _Act(key: Key('inquiry-close-${row.id}'), icon: Icons.archive_outlined, tooltip: l10n.inqClose, onTap: () => onSet('CLOSED')),
            ],
          ]),
        ],
      ]),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.text, this.color);
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
        child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
      );
}

/// A square icon button for the secondary actions.
class _Act extends StatelessWidget {
  const _Act({super.key, required this.icon, required this.tooltip, required this.onTap});
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Tooltip(
      message: tooltip,
      child: InkWell(
        borderRadius: BorderRadius.circular(13),
        onTap: onTap,
        child: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(color: colors.surface, border: Border.all(color: colors.hairline), borderRadius: BorderRadius.circular(13)),
          child: Icon(icon, size: 19, color: colors.ink),
        ),
      ),
    );
  }
}

/// The one main action on a card, gold and as wide as the room allows.
class _Primary extends StatelessWidget {
  const _Primary({super.key, required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        borderRadius: BorderRadius.circular(13),
        onTap: onTap,
        child: Container(
          height: 42,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: homeTint(context), border: Border.all(color: homeTintBorder(context)), borderRadius: BorderRadius.circular(13)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 18, color: AppPalette.gold600),
            const SizedBox(width: 7),
            Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppPalette.gold600)),
          ]),
        ),
      );
}

class _StatusSheet extends StatefulWidget {
  const _StatusSheet({required this.selected, required this.onApply});
  final String? selected;
  final ValueChanged<String?> onApply;

  @override
  State<_StatusSheet> createState() => _StatusSheetState();
}

class _StatusSheetState extends State<_StatusSheet> {
  late String? _s = widget.selected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return FilterSheet(
      title: l10n.inqFilterTitle,
      active: _s == null ? 0 : 1,
      onClear: () => setState(() => _s = null),
      applyLabel: l10n.inqFilterApply,
      onApply: () {
        widget.onApply(_s);
        Navigator.of(context).pop();
      },
      sections: [
        FilterSection(
          icon: Icons.flag_outlined,
          title: l10n.kcStatus,
          child: FilterRadioList<String?>(
            keyPrefix: 'inquiry-filter',
            selected: _s,
            onSelect: (v) => setState(() => _s = v),
            options: [
              FilterOption<String?>(null, l10n.leadsFilterAll),
              for (final st in const ['OPEN', 'RESPONDED', 'CLOSED']) FilterOption<String?>(st, inquiryStatusLabel(l10n, st), color: inquiryStatusColor(st, colors)),
            ],
          ),
        ),
      ],
    );
  }
}
