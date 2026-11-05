import 'dart:async';

import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../catalog/kit/catalog_kit.dart';
import '../../dashboard/home_kit/home_kit.dart';
import 'contract_create_data.dart';
import 'contract_form_kit.dart';

/// A contract without a booking, as the website's new-contract form: the
/// client and an available unit (searched on the server), the value
/// (prefilled from the unit's price) and down payment, the number if it
/// already has one, "signed before the system" with its real signing date,
/// and the document. The admin only.
class ManualContractScreen extends StatefulWidget {
  const ManualContractScreen({super.key, required this.repository});
  final ContractCreateRepository repository;

  @override
  State<ManualContractScreen> createState() => _ManualContractScreenState();
}

class _ManualContractScreenState extends State<ManualContractScreen> {
  PickHit? _client;
  PickHit? _unit;
  final _total = TextEditingController();
  final _down = TextEditingController();
  final _number = TextEditingController();
  bool _preSystem = false;
  DateTime? _signedAt;
  PickedDocument? _doc;
  bool _busy = false;
  bool _tried = false;

  @override
  void dispose() {
    _total.dispose();
    _down.dispose();
    _number.dispose();
    super.dispose();
  }

  double? _num(TextEditingController c) => double.tryParse(c.text.replaceAll(RegExp('[,، ]'), '').trim());

  String? _errTotal(AppLocalizations l10n) => (_num(_total) ?? 0) <= 0 ? l10n.mcRequired : null;
  String? _errDown(AppLocalizations l10n) {
    final d = _num(_down);
    final t = _num(_total);
    return d != null && t != null && d > t ? l10n.mcDownTooBig : null;
  }

  String? _errSigned(AppLocalizations l10n) => _preSystem && _signedAt == null ? l10n.mcSignedRequired : null;

  Future<void> _pick({required bool unit}) async {
    final l10n = context.l10n;
    final hit = await showModalBottomSheet<PickHit>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PickSheet(
        title: unit ? l10n.mcPickUnit : l10n.mcPickClient,
        hint: unit ? l10n.mcSearchUnit : l10n.mcSearchClient,
        search: unit ? widget.repository.searchUnits : widget.repository.searchClients,
        keyPrefix: unit ? 'pick-unit' : 'pick-client',
      ),
    );
    if (hit == null || !mounted) return;
    setState(() {
      if (unit) {
        _unit = hit;
        if (_total.text.trim().isEmpty && hit.amount != null) _total.text = hit.amount!.toStringAsFixed(0);
      } else {
        _client = hit;
      }
    });
  }

  Future<void> _create() async {
    final l10n = context.l10n;
    setState(() => _tried = true);
    if (_client == null || _unit == null || _errTotal(l10n) != null || _errDown(l10n) != null || _errSigned(l10n) != null) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    final r = await widget.repository.createManual(
      customerId: _client!.id,
      unitId: _unit!.id,
      total: _num(_total)!,
      down: _num(_down),
      number: _number.text,
      preSystem: _preSystem,
      signedAt: _signedAt,
      doc: _doc,
    );
    if (!mounted) return;
    setState(() => _busy = false);
    r.when(
      ok: (c) {
        messenger.showSnackBar(SnackBar(content: Text(c.signFailed ? l10n.cvSignFailed : l10n.mcPlanLater)));
        context.pushReplacement('/contracts/${c.id}');
      },
      err: (f) => messenger.showSnackBar(SnackBar(content: Text(f.userMessage(l10n)))),
    );
  }

  InputDecoration _deco(String? error, {String? hint}) => InputDecoration(
        isDense: true,
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFFB9B0A3)),
        errorText: error,
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: BorderSide(color: context.appColors.hairline)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: BorderSide(color: context.appColors.hairline)),
      );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final currency = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: Column(children: [
          HomeListHero(title: l10n.mcTitle, subtitle: l10n.mcSub, back: true),
          Expanded(
            child: ListView(padding: const EdgeInsets.only(bottom: 16), children: [
              HomeSection(
                icon: Icons.person_pin_circle_rounded,
                title: l10n.mcParties,
                child: FormCardBox(children: [
                  FormFieldBox(
                    label: l10n.cvClient,
                    error: _tried && _client == null ? l10n.mcRequired : null,
                    child: FormValueBox(
                      key: const Key('manual-client'),
                      text: _client == null ? l10n.mcPickClient : [_client!.title, ?_client!.subtitle].join(' · '),
                      placeholder: _client == null,
                      invalid: _tried && _client == null,
                      icon: Icons.search_rounded,
                      onTap: () => _pick(unit: false),
                    ),
                  ),
                  FormFieldBox(
                    label: l10n.cvUnit,
                    hint: l10n.mcUnitHint,
                    error: _tried && _unit == null ? l10n.mcRequired : null,
                    child: FormValueBox(
                      key: const Key('manual-unit'),
                      text: _unit == null ? l10n.mcPickUnit : [ltr(_unit!.title), if (_unit!.subtitle != null) _unit!.subtitle!].join(' · '),
                      placeholder: _unit == null,
                      invalid: _tried && _unit == null,
                      icon: Icons.search_rounded,
                      onTap: () => _pick(unit: true),
                    ),
                  ),
                ]),
              ),
              HomeSection(
                icon: Icons.payments_rounded,
                title: l10n.mcAmounts,
                child: FormCardBox(children: [
                  FormFieldBox(
                    label: '${l10n.mcTotal} ($currency)',
                    child: TextField(
                      key: const Key('manual-total'),
                      controller: _total,
                      keyboardType: TextInputType.number,
                      onChanged: (_) => setState(() {}),
                      decoration: _deco(_tried ? _errTotal(l10n) : null),
                    ),
                  ),
                  FormFieldBox(
                    label: '${l10n.mcDown} ($currency)',
                    child: TextField(
                      key: const Key('manual-down'),
                      controller: _down,
                      keyboardType: TextInputType.number,
                      onChanged: (_) => setState(() {}),
                      decoration: _deco(_errDown(l10n)),
                    ),
                  ),
                ]),
              ),
              HomeSection(
                icon: Icons.edit_calendar_rounded,
                title: l10n.cvData,
                child: FormCardBox(children: [
                  FormFieldBox(
                    label: l10n.mcNumber,
                    hint: l10n.mcNumberHint,
                    child: TextField(
                      key: const Key('manual-number'),
                      controller: _number,
                      textDirection: TextDirection.ltr,
                      maxLength: 50,
                      decoration: _deco(null, hint: 'CON-2026-0001').copyWith(counterText: ''),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Material(
                    color: _preSystem ? AppPalette.gold50 : Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(13),
                      side: BorderSide(color: _preSystem ? AppPalette.gold200 : colors.hairline),
                    ),
                    child: SwitchListTile(
                      key: const Key('manual-presystem'),
                      value: _preSystem,
                      onChanged: (v) => setState(() => _preSystem = v),
                      activeThumbColor: AppPalette.navy,
                      title: Text(l10n.mcPreSystem, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                      subtitle: Text(l10n.mcPreSystemHint, style: TextStyle(fontSize: 12, height: 1.4, color: colors.inkMuted)),
                    ),
                  ),
                  FormDateField(
                    fieldKey: const Key('manual-signed'),
                    label: _preSystem ? l10n.mcSignedAtRequired : l10n.cvSignedAt,
                    value: _signedAt,
                    placeholder: l10n.cvNotSigned,
                    clearable: true,
                    last: DateTime.now(),
                    error: _tried ? _errSigned(l10n) : null,
                    onChanged: (d) => setState(() => _signedAt = d),
                  ),
                  FormDocumentField(value: _doc, onChanged: (d) => setState(() => _doc = d)),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.md, 12, AppSpacing.md, 0),
                child: Text(l10n.mcPlanLater, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              ),
            ]),
          ),
          FormBottomBar(
            confirmKey: const Key('manual-create'),
            label: l10n.mcCreate,
            icon: Icons.note_add_rounded,
            busy: _busy,
            onConfirm: _create,
          ),
        ]),
      ),
    );
  }
}

/// A search sheet over the server: type, wait a moment, pick a row.
class PickSheet extends StatefulWidget {
  const PickSheet({super.key, required this.title, required this.hint, required this.search, this.keyPrefix = 'pick'});
  final String title;
  final String hint;
  final Future<List<PickHit>> Function(String q) search;
  final String keyPrefix;

  @override
  State<PickSheet> createState() => _PickSheetState();
}

class _PickSheetState extends State<PickSheet> {
  List<PickHit>? _hits;
  bool _failed = false;
  Timer? _debounce;
  int _ticket = 0;

  @override
  void initState() {
    super.initState();
    _run('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _run(String q) async {
    final t = ++_ticket;
    List<PickHit> hits;
    var failed = false;
    try {
      hits = await widget.search(q);
    } catch (_) {
      hits = const [];
      failed = true;
    }
    if (!mounted || t != _ticket) return;
    setState(() {
      _hits = hits;
      _failed = failed;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final currency = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.8),
        decoration: const BoxDecoration(color: Color(0xFFFBF7F0), borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(color: const Color(0xFFD9D0C2), borderRadius: BorderRadius.circular(9)),
            ),
          ),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Text(widget.title, style: homeDisplay(18, colors.inkStrong))),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
            child: TextField(
              key: Key('${widget.keyPrefix}-search'),
              autofocus: true,
              onChanged: (q) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 300), () => _run(q));
              },
              decoration: InputDecoration(
                hintText: widget.hint,
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                filled: true,
                fillColor: Colors.white,
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: colors.hairline)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: colors.hairline)),
              ),
            ),
          ),
          Flexible(
            child: _hits == null
                ? const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()))
                : _hits!.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(_failed ? l10n.errorUnknown : l10n.mcNoResults,
                            textAlign: TextAlign.center, style: TextStyle(color: colors.inkMuted)),
                      )
                    : ListView.separated(
                        shrinkWrap: true,
                        padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.paddingOf(context).bottom),
                        itemCount: _hits!.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 6),
                        itemBuilder: (context, i) {
                          final h = _hits![i];
                          return Material(
                            color: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: colors.hairline)),
                            child: ListTile(
                              key: Key('${widget.keyPrefix}-${h.id}'),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              title: Text(ltrRuns(h.title), style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                              subtitle: h.subtitle == null ? null : Text(ltrRuns(h.subtitle!), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                              trailing: h.amount == null
                                  ? null
                                  : Text('${ltr(catalogGrouped(h.amount!))} $currency', style: homeDisplay(13, colors.inkStrong)),
                              onTap: () => Navigator.of(context).pop(h),
                            ),
                          );
                        },
                      ),
          ),
        ]),
      ),
    );
  }
}
