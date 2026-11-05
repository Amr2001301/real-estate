import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../catalog/kit/catalog_kit.dart';
import '../../dashboard/home_kit/home_kit.dart';
import '../view/contract_page_screen.dart' show KvTable;
import 'contract_create_data.dart';
import 'contract_form_kit.dart';

/// Convert an approved booking into a contract (owner-approved design k3,
/// 2026-11-04), as the website's convert form: the booking's client, unit,
/// consultant and booking amount; the plan it saved; the instalments' start,
/// an optional signing date and document. Blocked, with the reason, while
/// the booking amount is unpaid or the saved term is missing. The admin only.
class ConvertReservationScreen extends StatefulWidget {
  const ConvertReservationScreen({super.key, required this.reservationId, required this.repository});
  final String reservationId;
  final ContractCreateRepository repository;

  @override
  State<ConvertReservationScreen> createState() => _ConvertReservationScreenState();
}

class _ConvertReservationScreenState extends State<ConvertReservationScreen> {
  ConvertSource? _src;
  AppFailure? _failure;
  late DateTime _starts = () {
    final n = DateTime.now();
    return DateTime(n.year, n.month + 1, n.day);
  }();
  DateTime? _signedAt;
  PickedDocument? _doc;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _failure = null);
    final r = await widget.repository.reservation(widget.reservationId);
    if (!mounted) return;
    r.when(ok: (s) => setState(() => _src = s), err: (f) => setState(() => _failure = f));
  }

  Future<void> _confirm(ConvertSource s) async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    final r = await widget.repository.convert(s.id, startsAt: s.needsStart ? _starts : null, signedAt: _signedAt, doc: _doc);
    if (!mounted) return;
    setState(() => _busy = false);
    r.when(
      ok: (c) {
        if (c.signFailed) messenger.showSnackBar(SnackBar(content: Text(l10n.cvSignFailed)));
        context.pushReplacement('/contracts/${c.id}');
      },
      err: (f) => messenger.showSnackBar(SnackBar(content: Text(f.userMessage(l10n)))),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final s = _src;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: Column(children: [
          HomeListHero(title: l10n.cvTitle, subtitle: s?.number == null ? null : l10n.cvReservationN(ltr(s!.number!)), back: true),
          Expanded(
            child: s == null
                ? (_failure != null ? ErrorState(failure: _failure, onRetry: _load) : const Center(child: CircularProgressIndicator()))
                : ListView(padding: const EdgeInsets.only(top: 14, bottom: 16), children: _body(context, s)),
          ),
          if (s != null)
            FormBottomBar(
              confirmKey: const Key('convert-confirm'),
              label: l10n.cvConfirm,
              icon: Icons.description_rounded,
              busy: _busy,
              onConfirm: s.canConvert ? () => _confirm(s) : null,
            ),
        ]),
      ),
    );
  }

  List<Widget> _body(BuildContext context, ConvertSource s) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final currency = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    String money(double? v) => v == null ? '—' : '${ltr(catalogGrouped(v))} $currency';
    return [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: homeCard(context, radius: 22),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Container(
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(12)),
                  child: Text(homeInitials(s.clientName), style: homeDisplay(13, AppPalette.gold300)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(l10n.cvClient, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                    Text(s.clientName ?? '—', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                  ]),
                ),
                if (s.status == 'APPROVED') CatalogBadge.status(l10n.cvApproved, catalogAvailable),
              ]),
              Divider(height: 24, color: colors.hairline),
              Wrap(runSpacing: 12, children: [
                for (final (k, v) in [
                  (l10n.cvUnit, s.unitCode == null ? '—' : ltr(s.unitCode!)),
                  (l10n.cvProject, s.projectName ?? '—'),
                  (l10n.cvSales, s.salesName ?? '—'),
                  (l10n.cvBooking, money(s.bookingAmount)),
                ])
                  FractionallySizedBox(
                    widthFactor: 0.5,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(k, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                      Text(v, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                    ]),
                  ),
              ]),
            ]),
          ),
          if (s.snapshotMissing)
            FormWarning(key: const Key('convert-snapshot-missing'), text: l10n.cvSnapshotMissing, error: true)
          else if (s.bookingBlocks)
            FormWarning(key: const Key('convert-unpaid'), text: l10n.cvUnpaidWarn),
        ]),
      ),
      if (!s.snapshotMissing && s.months != null)
        HomeSection(
          icon: Icons.payments_rounded,
          title: l10n.cvPlan,
          child: KvTable(rows: [
            (l10n.cvDown, money(s.down)),
            (l10n.cvTerm, l10n.cvMonthsN(s.months!)),
            (l10n.cvMonthly, money(s.monthly)),
            (l10n.cvTotal, money(s.total)),
          ]),
        ),
      HomeSection(
        icon: Icons.edit_calendar_rounded,
        title: l10n.cvData,
        child: FormCardBox(children: [
          if (s.needsStart)
            FormDateField(
              fieldKey: const Key('convert-starts'),
              label: l10n.cvStarts,
              value: _starts,
              placeholder: '—',
              onChanged: (d) => setState(() => _starts = d ?? _starts),
            ),
          FormDateField(
            fieldKey: const Key('convert-signed'),
            label: l10n.cvSignedAt,
            value: _signedAt,
            placeholder: l10n.cvNotSigned,
            clearable: true,
            last: DateTime.now(),
            onChanged: (d) => setState(() => _signedAt = d),
          ),
          FormDocumentField(value: _doc, onChanged: (d) => setState(() => _doc = d)),
        ]),
      ),
    ];
  }
}
