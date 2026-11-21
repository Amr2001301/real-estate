import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;

import '../../common/staff_list_skeleton.dart';
import '../leads/presentation/screens/leads_screen.dart' show leadWhen;
import 'audit_labels.dart';

/// The website's «سجل التدقيق» (`/audit-logs`), read-only: who did what and
/// when. Searching and reading are all it does; nothing here changes data.

class AuditEntry extends Equatable {
  const AuditEntry({
    required this.id,
    required this.action,
    required this.entityType,
    this.entityId,
    this.actorName,
    this.ip,
    this.before,
    this.after,
    this.createdAt,
  });

  final String id;
  final String action;
  final String entityType;
  final String? entityId;
  final String? actorName;
  final String? ip;
  final Object? before;
  final Object? after;
  final DateTime? createdAt;

  factory AuditEntry.fromJson(Map<String, dynamic> j) => AuditEntry(
        id: j['id'] as String? ?? '',
        action: j['action'] as String? ?? '',
        entityType: j['entityType'] as String? ?? '',
        entityId: j['entityId'] as String?,
        actorName: (j['actor'] as Map?)?['fullName'] as String?,
        ip: j['ip'] as String?,
        before: j['before'],
        after: j['after'],
        createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '')?.toLocal(),
      );

  @override
  List<Object?> get props => [id, action, entityType, entityId, actorName, createdAt];
}

class AuditRepository {
  AuditRepository(this._dio);
  final Dio _dio;

  Future<Result<Paginated<AuditEntry>>> list({String? q, int page = 1}) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/audit-logs', queryParameters: {
          'page': page,
          'pageSize': 25,
          if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
        });
        return Paginated.fromJson(res.data ?? const {}, AuditEntry.fromJson);
      });
}

class AuditScreen extends StatefulWidget {
  const AuditScreen({super.key, required this.repository});
  final AuditRepository repository;

  @override
  State<AuditScreen> createState() => _AuditScreenState();
}

class _AuditScreenState extends State<AuditScreen> {
  final _scroll = ScrollController();
  final _search = TextEditingController();
  List<AuditEntry> _rows = const [];
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
    final r = await widget.repository.list(q: _search.text);
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
    final r = await widget.repository.list(q: _search.text, page: _page + 1);
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
            key: const Key('audit-log'),
            controller: _scroll,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 100),
            children: [
              HomeListHero(
                back: true,
                title: l10n.audTitle,
                subtitle: _loading ? null : l10n.audCountN(_total),
                bottom: TextField(
                  key: const Key('audit-search'),
                  controller: _search,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _load(),
                  decoration: InputDecoration(
                    hintText: l10n.audSearchHint,
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
                EmptyState(icon: Icons.history_rounded, title: l10n.audTitle, message: l10n.audEmpty)
              else
                for (final r in _rows)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.md, 10, AppSpacing.md, 0),
                    child: _EntryCard(entry: r, onTap: () => _open(r)),
                  ),
              if (_loadingMore) const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator())),
            ],
          ),
        ),
      ),
    );
  }

  void _open(AuditEntry e) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => _EntrySheet(entry: e),
      );
}

class _EntryCard extends StatelessWidget {
  const _EntryCard({required this.entry, required this.onTap});
  final AuditEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final icon = switch (entry.action.toUpperCase()) {
      'POST' => Icons.add_circle_outline_rounded,
      'DELETE' => Icons.delete_outline_rounded,
      'PATCH' || 'PUT' => Icons.edit_outlined,
      _ => Icons.bolt_rounded,
    };
    return DvEntityCard(
      inkKey: Key('audit-${entry.id}'),
      onTap: onTap,
      icon: icon,
      title: auditTitle(entry.action, entry.entityType, lang),
      titleLines: 2,
      subtitle: auditThing(entry.entityType, lang),
      footIcon: Icons.person_outline_rounded,
      footColor: colors.inkMuted,
      footText: entry.actorName ?? l10n.audSystem,
      footSub: entry.createdAt == null ? null : leadWhen(context, entry.createdAt!),
    );
  }
}

class _EntrySheet extends StatelessWidget {
  const _EntrySheet({required this.entry});
  final AuditEntry entry;

  String _json(Object? v) => v == null ? '' : const JsonEncoder.withIndent('  ').convert(v);

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final before = _json(entry.before);
    final after = _json(entry.after);
    Widget block(String title, String body) => Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: colors.surface, border: Border.all(color: colors.hairline), borderRadius: BorderRadius.circular(12)),
              child: SelectableText(body, textDirection: TextDirection.ltr, style: const TextStyle(fontFamily: 'monospace', fontSize: 11.5)),
            ),
          ]),
        );
    Widget row(String k, String v) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(children: [
            Text(k, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
            const SizedBox(width: 12),
            Expanded(child: Text(v, textAlign: TextAlign.end, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
          ]),
        );
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text(auditTitle(entry.action, entry.entityType, Localizations.localeOf(context).languageCode), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          row(l10n.audActor, entry.actorName ?? l10n.audSystem),
          row(l10n.audEntity, auditThing(entry.entityType, Localizations.localeOf(context).languageCode)),
          row('API', ltr('${entry.action} ${entry.entityType}')),
          if (entry.entityId != null) row('ID', ltr(entry.entityId!)),
          if (entry.ip != null) row(l10n.audIp, ltr(entry.ip!)),
          if (entry.createdAt != null) row(l10n.audWhen, leadWhen(context, entry.createdAt!)),
          if (before.isEmpty && after.isEmpty)
            Padding(padding: const EdgeInsets.only(top: 12), child: Text(l10n.audNoChanges, style: TextStyle(color: colors.inkMuted)))
          else ...[
            if (before.isNotEmpty) block(l10n.audBefore, before),
            if (after.isNotEmpty) block(l10n.audAfter, after),
          ],
        ]),
      ),
    );
  }
}
