import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;

import '../../../../common/staff_list_skeleton.dart';
import '../../../leads/presentation/screens/leads_screen.dart' show leadWhen;
import '../../data/dtos/maintenance_dtos.dart';
import '../../data/mappers/maintenance_mapper.dart';
import '../../domain/entities/maintenance_request.dart';
import '../maintenance_format.dart';

/// The website's «الصيانة» for the admin (`/maintenance-requests`): every
/// request with its review state, approve / reject, assign, and the status
/// steps. The supervisor's own screens (`/me/maintenance-requests`) stay as they are.

/// A request as the admin sees it: the shared fields plus who it is assigned to.
class AdminMaintenanceRow extends Equatable {
  const AdminMaintenanceRow({required this.request, this.assignedId, this.assignedName});
  final MaintenanceRequest request;
  final String? assignedId;
  final String? assignedName;

  factory AdminMaintenanceRow.fromJson(Map<String, dynamic> j) {
    final admin = j['assignedAdmin'];
    return AdminMaintenanceRow(
      request: MaintenanceRequestDto.fromJson(j).toEntity(),
      assignedId: j['assignedAdminId'] as String?,
      assignedName: admin is Map ? admin['fullName'] as String? : null,
    );
  }

  @override
  List<Object?> get props => [request, assignedId, assignedName];
}

/// One person a request can be assigned to.
class StaffChoice extends Equatable {
  const StaffChoice(this.id, this.name);
  final String id;
  final String name;

  @override
  List<Object?> get props => [id, name];
}

class AdminMaintenanceRepository {
  AdminMaintenanceRepository(this._dio);
  final Dio _dio;

  Future<Result<Paginated<AdminMaintenanceRow>>> list({String? status, String? reviewStatus, String? q, int page = 1}) =>
      guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/maintenance-requests', queryParameters: {
          'page': page,
          'pageSize': 20,
          'status': ?status,
          'reviewStatus': ?reviewStatus,
          if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
        });
        return Paginated.fromJson(res.data ?? const {}, AdminMaintenanceRow.fromJson);
      });

  Future<Result<AdminMaintenanceRow>> detail(String id) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/maintenance-requests/$id');
        return AdminMaintenanceRow.fromJson(res.data ?? const {});
      });

  Future<Result<void>> approve(String id) => guardApiCall(() async => _dio.post<void>('/maintenance-requests/$id/approve'));

  Future<Result<void>> reject(String id) => guardApiCall(() async => _dio.post<void>('/maintenance-requests/$id/reject'));

  Future<Result<void>> assign(String id, String staffId) =>
      guardApiCall(() async => _dio.post<void>('/maintenance-requests/$id/assign', data: {'assignedAdminId': staffId}));

  Future<Result<void>> setStatus(String id, MaintenanceStatus status) =>
      guardApiCall(() async => _dio.post<void>('/maintenance-requests/$id/status', data: {'status': status.wire}));

  Future<Result<List<StaffChoice>>> staff() => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/users/options', queryParameters: {'role': 'ADMIN,MAINTENANCE_SUPERVISOR', 'active': 'true'});
        final data = (res.data?['data'] as List?) ?? const [];
        return [
          for (final u in data.whereType<Map>())
            StaffChoice(u['id'] as String? ?? '', (u['fullName'] ?? u['name'] ?? '') as String),
        ].where((s) => s.id.isNotEmpty).toList();
      });
}

String reviewLabel(AppLocalizations l10n, String? s) => switch (s) {
      'APPROVED' => l10n.mtaReviewApproved,
      'REJECTED' => l10n.mtaReviewRejected,
      _ => l10n.mtaReviewPending,
    };

BadgeTone reviewTone(String? s) => switch (s) {
      'APPROVED' => BadgeTone.success,
      'REJECTED' => BadgeTone.error,
      _ => BadgeTone.warning,
    };

/// The status steps the dashboard offers from each state.
List<MaintenanceStatus> adminNextStatuses(MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.open => const [MaintenanceStatus.assigned, MaintenanceStatus.inProgress],
      MaintenanceStatus.assigned => const [MaintenanceStatus.inProgress, MaintenanceStatus.open],
      MaintenanceStatus.inProgress => const [MaintenanceStatus.resolved, MaintenanceStatus.assigned],
      MaintenanceStatus.resolved => const [MaintenanceStatus.closed, MaintenanceStatus.inProgress],
      _ => const [],
    };

// ── List ─────────────────────────────────────────────────────────────────────

class AdminMaintenanceScreen extends StatefulWidget {
  const AdminMaintenanceScreen({super.key, required this.repository, required this.onOpen});
  final AdminMaintenanceRepository repository;
  final void Function(String id) onOpen;

  @override
  State<AdminMaintenanceScreen> createState() => _AdminMaintenanceScreenState();
}

class _AdminMaintenanceScreenState extends State<AdminMaintenanceScreen> {
  final _scroll = ScrollController();
  final _search = TextEditingController();
  List<AdminMaintenanceRow> _rows = const [];
  String? _status;
  String? _review;
  int _page = 1;
  int _total = 0;
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
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _rows.isEmpty;
      _failure = null;
    });
    final r = await widget.repository.list(status: _status, reviewStatus: _review, q: _search.text);
    if (!mounted) return;
    setState(() {
      _loading = false;
      switch (r) {
        case Ok(data: final v):
          _rows = v.data;
          _more = v.hasMore;
          _total = v.meta.total;
          _page = 1;
        case Err(failure: final f):
          _failure = f;
      }
    });
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    final r = await widget.repository.list(status: _status, reviewStatus: _review, q: _search.text, page: _page + 1);
    if (!mounted) return;
    setState(() {
      _loadingMore = false;
      if (r case Ok(data: final v)) {
        _rows = [..._rows, ...v.data];
        _more = v.hasMore;
        _page++;
      }
    });
  }

  Future<void> _open(String id) async {
    widget.onOpen(id);
  }

  void _filters() => showFilterSheet(
        context,
        (_) => _FilterSheet(
          status: _status,
          review: _review,
          onApply: (s, r) {
            _status = s;
            _review = r;
            _load();
          },
        ),
      );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            key: const Key('admin-maintenance'),
            controller: _scroll,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 100),
            children: [
              HomeListHero(
                back: true,
                title: l10n.mtaTitle,
                subtitle: _loading ? null : l10n.mtaCountN(_total),
                actions: [
                  HomeHeroButton(
                    key: const Key('admin-maintenance-filters'),
                    icon: Icons.tune_rounded,
                    dot: _status != null || _review != null,
                    tooltip: l10n.mtaFilterTitle,
                    onTap: _filters,
                  ),
                ],
                bottom: TextField(
                  key: const Key('admin-maintenance-search'),
                  controller: _search,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _load(),
                  decoration: InputDecoration(
                    hintText: l10n.mtaSearchHint,
                    prefixIcon: const Icon(Icons.search_rounded),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  ),
                ),
              ),
              if (_loading)
                const SizedBox(height: 480, child: StaffListSkeleton())
              else if (_failure != null)
                ErrorState(failure: _failure, onRetry: _load)
              else if (_rows.isEmpty)
                EmptyState(icon: Icons.build_circle_outlined, title: l10n.mtaTitle, message: l10n.mtaEmpty)
              else
                for (final r in _rows)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.md, 10, AppSpacing.md, 0),
                    child: _RequestCard(row: r, onTap: () => _open(r.request.id)),
                  ),
              if (_loadingMore) const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator())),
            ],
          ),
        ),
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.row, required this.onTap});
  final AdminMaintenanceRow row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final r = row.request;
    final title = r.categoryName?.resolve(lang) ?? l10n.mtaTitle;
    final who = [if (r.customerName != null) r.customerName!, if (r.unitCode != null) ltr(r.unitCode!)].join(' · ');
    final tone = switch (r.reviewStatus) {
      'APPROVED' => colors.success,
      'REJECTED' => colors.error,
      _ => colors.warning,
    };
    return DvEntityCard(
      inkKey: Key('maintenance-${r.id}'),
      onTap: onTap,
      icon: Icons.build_rounded,
      title: who.isEmpty ? title : who,
      subtitle: '$title · ${maintenanceStatusLabel(l10n, r.status)} · ${maintenancePriorityLabel(l10n, r.priority)}',
      status: reviewLabel(l10n, r.reviewStatus),
      statusColor: tone,
      footIcon: Icons.notes_rounded,
      footColor: colors.ink,
      footText: r.description,
      footSub: [row.assignedName ?? l10n.mtaUnassigned, if (r.createdAt != null) leadWhen(context, r.createdAt!.toLocal())].join(' · '),
    );
  }
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.status, required this.review, required this.onApply});
  final String? status;
  final String? review;
  final void Function(String? status, String? review) onApply;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late String? _s = widget.status;
  late String? _r = widget.review;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return FilterSheet(
      title: l10n.mtaFilterTitle,
      active: (_s == null ? 0 : 1) + (_r == null ? 0 : 1),
      onClear: () => setState(() {
        _s = null;
        _r = null;
      }),
      applyLabel: l10n.mtaFilterApply,
      onApply: () {
        widget.onApply(_s, _r);
        Navigator.of(context).pop();
      },
      sections: [
        FilterSection(
          icon: Icons.fact_check_outlined,
          title: l10n.mtaFilterReview,
          child: FilterRadioList<String?>(
            keyPrefix: 'maintenance-review',
            selected: _r,
            onSelect: (v) => setState(() => _r = v),
            options: [
              FilterOption<String?>(null, l10n.leadsFilterAll),
              for (final v in const ['PENDING', 'APPROVED', 'REJECTED']) FilterOption<String?>(v, reviewLabel(l10n, v)),
            ],
          ),
        ),
        FilterSection(
          icon: Icons.flag_outlined,
          title: l10n.kcStatus,
          child: FilterRadioList<String?>(
            keyPrefix: 'maintenance-status',
            selected: _s,
            onSelect: (v) => setState(() => _s = v),
            options: [
              FilterOption<String?>(null, l10n.leadsFilterAll),
              for (final st in const [
                MaintenanceStatus.open,
                MaintenanceStatus.assigned,
                MaintenanceStatus.inProgress,
                MaintenanceStatus.resolved,
                MaintenanceStatus.closed,
              ])
                FilterOption<String?>(st.wire, maintenanceStatusLabel(l10n, st)),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Detail ───────────────────────────────────────────────────────────────────

class AdminMaintenanceDetailScreen extends StatefulWidget {
  const AdminMaintenanceDetailScreen({super.key, required this.repository, required this.id});
  final AdminMaintenanceRepository repository;
  final String id;

  @override
  State<AdminMaintenanceDetailScreen> createState() => _AdminMaintenanceDetailScreenState();
}

class _AdminMaintenanceDetailScreenState extends State<AdminMaintenanceDetailScreen> {
  AdminMaintenanceRow? _row;
  bool _loading = true;
  bool _working = false;
  AppFailure? _failure;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final r = await widget.repository.detail(widget.id);
    if (!mounted) return;
    setState(() {
      _loading = false;
      switch (r) {
        case Ok(data: final v):
          _row = v;
          _failure = null;
        case Err(failure: final f):
          _failure = f;
      }
    });
  }

  Future<void> _run(Future<Result<void>> Function() action) async {
    if (_working) return;
    setState(() => _working = true);
    final r = await action();
    if (!mounted) return;
    final l10n = context.l10n;
    setState(() => _working = false);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(r is Err ? l10n.mtaActionFailed : l10n.mtaActionDone)));
    if (r is! Err) await _load();
  }

  Future<void> _reject() async {
    final l10n = context.l10n;
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(l10n.mtaRejectAsk),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l10n.mtaKeep)),
          TextButton(key: const Key('maintenance-reject-confirm'), onPressed: () => Navigator.pop(ctx, true), child: Text(l10n.mtaConfirmReject)),
        ],
      ),
    );
    if (yes == true) await _run(() => widget.repository.reject(widget.id));
  }

  Future<void> _assign() async {
    final l10n = context.l10n;
    final staff = (await widget.repository.staff()).dataOrNull ?? const <StaffChoice>[];
    if (!mounted) return;
    final picked = await showModalBottomSheet<StaffChoice>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(l10n.mtaAssignTitle, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          ),
          if (staff.isEmpty)
            Padding(padding: const EdgeInsets.all(24), child: Text(l10n.mtaNoStaff))
          else
            Flexible(
              child: ListView(shrinkWrap: true, children: [
                for (final s in staff)
                  ListTile(
                    key: Key('maintenance-assign-${s.id}'),
                    leading: const Icon(Icons.person_outline_rounded),
                    title: Text(s.name),
                    onTap: () => Navigator.pop(ctx, s),
                  ),
              ]),
            ),
        ]),
      ),
    );
    if (picked != null) await _run(() => widget.repository.assign(widget.id, picked.id));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final row = _row;
    final r = row?.request;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: ListView(
          key: const Key('admin-maintenance-detail'),
          padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 40),
          children: [
            HomeListHero(
              back: true,
              title: r?.categoryName?.resolve(lang) ?? l10n.supervisorDetailTitle,
              subtitle: r?.unitCode == null ? null : ltr(r!.unitCode!),
            ),
            if (_loading)
              const SizedBox(height: 360, child: Center(child: CircularProgressIndicator()))
            else if (r == null)
              ErrorState(failure: _failure, onRetry: _load)
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: homeCard(context, radius: 22),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Wrap(spacing: 8, runSpacing: 6, children: [
                        StatusBadge(label: reviewLabel(l10n, r.reviewStatus), tone: reviewTone(r.reviewStatus)),
                        StatusBadge(label: maintenanceStatusLabel(l10n, r.status), tone: maintenanceStatusTone(r.status)),
                        StatusBadge(label: maintenancePriorityLabel(l10n, r.priority), tone: maintenancePriorityTone(r.priority)),
                      ]),
                      const SizedBox(height: 12),
                      Text(r.description, style: TextStyle(fontSize: 14.5, height: 1.6, color: colors.ink)),
                    ]),
                  ),
                  const SizedBox(height: 12),
                  _Facts(rows: [
                    (l10n.supervisorDetailCustomerLabel, r.customerName ?? '—'),
                    (l10n.supervisorDetailPhoneLabel, r.customerPhone == null ? '—' : ltr(r.customerPhone!)),
                    (l10n.supervisorDetailUnitLabel, r.unitCode == null ? '—' : ltr(r.unitCode!)),
                    (l10n.mtaAssignedTo, row!.assignedName ?? l10n.mtaUnassigned),
                    if (r.dueAt != null) (l10n.supervisorDetailDueDateLabel, leadWhen(context, r.dueAt!.toLocal())),
                  ]),
                  const SizedBox(height: 12),
                  _Actions(
                    row: row,
                    working: _working,
                    onApprove: () => _run(() => widget.repository.approve(widget.id)),
                    onReject: _reject,
                    onAssign: _assign,
                    onStatus: (s) => _run(() => widget.repository.setStatus(widget.id, s)),
                  ),
                ]),
              ),
          ],
        ),
      ),
    );
  }
}

class _Facts extends StatelessWidget {
  const _Facts({required this.rows});
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: homeCard(context, radius: 22),
      child: Column(children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) Divider(height: 1, color: colors.hairline),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 11),
            child: Row(children: [
              Text(rows[i].$1, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(rows[i].$2, textAlign: TextAlign.end, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
              ),
            ]),
          ),
        ],
      ]),
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({
    required this.row,
    required this.working,
    required this.onApprove,
    required this.onReject,
    required this.onAssign,
    required this.onStatus,
  });
  final AdminMaintenanceRow row;
  final bool working;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  final VoidCallback onAssign;
  final ValueChanged<MaintenanceStatus> onStatus;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final r = row.request;
    final pending = r.reviewStatus == 'PENDING' || r.reviewStatus == null;
    final approved = r.reviewStatus == 'APPROVED';
    final steps = approved ? adminNextStatuses(r.status) : const <MaintenanceStatus>[];
    final buttons = <Widget>[
      if (pending) ...[
        _Btn(key: const Key('maintenance-approve'), icon: Icons.check_rounded, label: l10n.mtaApprove, primary: true, onTap: working ? null : onApprove),
        _Btn(key: const Key('maintenance-reject'), icon: Icons.close_rounded, label: l10n.mtaReject, danger: true, onTap: working ? null : onReject),
      ],
      if (approved)
        _Btn(
          key: const Key('maintenance-assign'),
          icon: Icons.person_add_alt_1_rounded,
          label: row.assignedId == null ? l10n.mtaAssign : l10n.mtaReassign,
          onTap: working ? null : onAssign,
        ),
      for (final s in steps)
        _Btn(
          key: Key('maintenance-status-${s.wire}'),
          icon: Icons.arrow_forward_rounded,
          label: l10n.mtaMoveTo(maintenanceStatusLabel(l10n, s)),
          onTap: working ? null : () => onStatus(s),
        ),
    ];
    if (buttons.isEmpty) {
      return Padding(padding: const EdgeInsets.all(12), child: Text(l10n.mtaNoActions, textAlign: TextAlign.center, style: TextStyle(color: context.appColors.inkMuted)));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final b in buttons) Padding(padding: const EdgeInsets.only(bottom: 8), child: b),
    ]);
  }
}

class _Btn extends StatelessWidget {
  const _Btn({super.key, required this.icon, required this.label, required this.onTap, this.primary = false, this.danger = false});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool primary;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final fg = danger ? colors.error : (primary ? AppPalette.gold600 : colors.ink);
    return Opacity(
      opacity: onTap == null ? 0.5 : 1,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: primary ? homeTint(context) : colors.surface,
            border: Border.all(color: primary ? homeTintBorder(context) : colors.hairline),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 18, color: fg),
            const SizedBox(width: 8),
            Text(label, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: fg)),
          ]),
        ),
      ),
    );
  }
}
