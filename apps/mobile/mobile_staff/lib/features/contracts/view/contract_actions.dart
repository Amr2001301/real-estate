import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

/// The admin's two contract actions from the website's contract page: the unit's
/// handover and the cancellation. Both are ADMIN-only on the server.
class ContractActionsRepository {
  ContractActionsRepository(this._dio);
  final Dio _dio;

  /// What the company's policy suggests for a cancellation (a pre-fill only).
  Future<Result<({double collected, double retained, double refund})>> suggestion(String id) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/contracts/$id/cancellation-suggestion');
        double n(Object? v) => double.tryParse('${v ?? 0}') ?? 0;
        final d = res.data ?? const {};
        return (collected: n(d['totalCollected']), retained: n(d['suggestedRetained']), refund: n(d['suggestedRefund']));
      });

  Future<Result<void>> cancel(String id, {required String reason, required double retained, required double refund, String? notes}) =>
      guardApiCall(() async => _dio.post<void>('/contracts/$id/cancel', data: {
            'reason': reason,
            'retainedAmount': retained,
            'refundAmount': refund,
            if (notes != null && notes.trim().isNotEmpty) 'financialNotes': notes.trim(),
          }));

  Future<Result<void>> handover(String id, {required DateTime date, required Map<String, bool> checklist, String? notes}) =>
      guardApiCall(() async => _dio.post<void>('/contracts/$id/handover', data: {
            'handedOverAt': '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
            'checklist': [for (final e in checklist.entries) {'key': e.key, 'done': e.value}],
            if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
          }));
}

/// Shows the sheet; true when the action was saved.
Future<bool> showHandoverSheet(BuildContext context, {required ContractActionsRepository repository, required String contractId}) async {
  final done = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _HandoverSheet(repository: repository, contractId: contractId),
  );
  return done == true;
}

Future<bool> showCancelContractSheet(BuildContext context, {required ContractActionsRepository repository, required String contractId}) async {
  final done = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _CancelSheet(repository: repository, contractId: contractId),
  );
  return done == true;
}

class _SheetFrame extends StatelessWidget {
  const _SheetFrame({required this.title, required this.children, required this.action});
  final String title;
  final List<Widget> children;
  final Widget action;

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              const SizedBox(height: 14),
              ...children,
              const SizedBox(height: 16),
              action,
            ]),
          ),
        ),
      );
}

class _HandoverSheet extends StatefulWidget {
  const _HandoverSheet({required this.repository, required this.contractId});
  final ContractActionsRepository repository;
  final String contractId;

  @override
  State<_HandoverSheet> createState() => _HandoverSheetState();
}

class _HandoverSheetState extends State<_HandoverSheet> {
  DateTime _date = DateTime.now();
  final _notes = TextEditingController();
  final _done = <String, bool>{'keys': false, 'meters': false, 'inspection': false, 'snags': false, 'documents': false};
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2000), lastDate: DateTime.now());
    if (d != null) setState(() => _date = d);
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final r = await widget.repository.handover(widget.contractId, date: _date, checklist: _done, notes: _notes.text);
    if (!mounted) return;
    if (r is Err) {
      setState(() {
        _saving = false;
        _error = r.failure.validationMessages.isNotEmpty ? r.failure.validationMessages.first : context.l10n.ctaFailed;
      });
      return;
    }
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final labels = {
      'keys': l10n.ctaCheckKeys,
      'meters': l10n.ctaCheckMeters,
      'inspection': l10n.ctaCheckInspection,
      'snags': l10n.ctaCheckSnags,
      'documents': l10n.ctaCheckDocuments,
    };
    return _SheetFrame(
      title: l10n.ctaHandover,
      action: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_error!, style: TextStyle(color: context.appColors.error))),
        FilledButton(key: const Key('handover-save'), onPressed: _saving ? null : _save, child: Text(l10n.ctaSave)),
      ]),
      children: [
        Text(l10n.ctaHandoverDesc, style: TextStyle(fontSize: 12.5, color: context.appColors.inkMuted)),
        const SizedBox(height: 12),
        ListTile(
          key: const Key('handover-date'),
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.event_rounded),
          title: Text(l10n.ctaHandoverDate),
          trailing: Text(DateFormatter.mediumDate(_date, languageCode: lang), style: const TextStyle(fontWeight: FontWeight.w800)),
          onTap: _pick,
        ),
        Text(l10n.ctaChecklist, style: const TextStyle(fontWeight: FontWeight.w700)),
        for (final e in labels.entries)
          CheckboxListTile(
            key: Key('handover-${e.key}'),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            value: _done[e.key],
            title: Text(e.value),
            onChanged: (v) => setState(() => _done[e.key] = v ?? false),
          ),
        TextField(controller: _notes, minLines: 2, maxLines: 4, decoration: InputDecoration(labelText: l10n.ctaNotes)),
      ],
    );
  }
}

class _CancelSheet extends StatefulWidget {
  const _CancelSheet({required this.repository, required this.contractId});
  final ContractActionsRepository repository;
  final String contractId;

  @override
  State<_CancelSheet> createState() => _CancelSheetState();
}

class _CancelSheetState extends State<_CancelSheet> {
  final _reason = TextEditingController();
  final _retained = TextEditingController(text: '0');
  final _refund = TextEditingController(text: '0');
  final _notes = TextEditingController();
  double? _collected;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _prefill();
  }

  @override
  void dispose() {
    _reason.dispose();
    _retained.dispose();
    _refund.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _prefill() async {
    final r = await widget.repository.suggestion(widget.contractId);
    if (!mounted) return;
    if (r case Ok(data: final s)) {
      setState(() {
        _collected = s.collected;
        _retained.text = s.retained.toStringAsFixed(2);
        _refund.text = s.refund.toStringAsFixed(2);
      });
    }
  }

  double _n(TextEditingController c) => double.tryParse(c.text.replaceAll(',', '.').trim()) ?? 0;

  Future<void> _confirm() async {
    final l10n = context.l10n;
    if (_reason.text.trim().isEmpty) {
      setState(() => _error = l10n.ctaReasonRequired);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final r = await widget.repository.cancel(widget.contractId, reason: _reason.text.trim(), retained: _n(_retained), refund: _n(_refund), notes: _notes.text);
    if (!mounted) return;
    if (r is Err) {
      setState(() {
        _saving = false;
        _error = r.failure.validationMessages.isNotEmpty ? r.failure.validationMessages.first : context.l10n.ctaFailed;
      });
      return;
    }
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return _SheetFrame(
      title: l10n.ctaCancelContract,
      action: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_error!, style: TextStyle(color: colors.error))),
        FilledButton(
          key: const Key('cancel-confirm'),
          style: FilledButton.styleFrom(backgroundColor: colors.error),
          onPressed: _saving ? null : _confirm,
          child: Text(l10n.ctaConfirmCancel),
        ),
      ]),
      children: [
        Text('${l10n.ctaCancelDesc} ${l10n.ctaCancelWarn}', style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
        if (_collected != null) ...[
          const SizedBox(height: 10),
          Text('${l10n.ctaCollected}: ${_collected!.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
        const SizedBox(height: 12),
        TextField(key: const Key('cancel-reason'), controller: _reason, minLines: 2, maxLines: 4, decoration: InputDecoration(labelText: l10n.ctaCancelReason)),
        const SizedBox(height: 10),
        TextField(
          key: const Key('cancel-retained'),
          controller: _retained,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(labelText: l10n.ctaRetained),
        ),
        const SizedBox(height: 10),
        TextField(
          key: const Key('cancel-refund'),
          controller: _refund,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(labelText: l10n.ctaRefund),
        ),
        const SizedBox(height: 10),
        TextField(controller: _notes, minLines: 1, maxLines: 3, decoration: InputDecoration(labelText: l10n.ctaCancelNotes)),
      ],
    );
  }
}
