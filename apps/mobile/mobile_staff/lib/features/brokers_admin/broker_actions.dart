import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../dashboard/home_kit/home_kit.dart';
import '../permissions/staff_permissions.dart';
import 'brokers_hub_screen.dart';

/// What the company can do with a broker firm, lead, commission or payout —
/// the website's buttons on those pages, each behind the code the API asks for.
enum BrokerAction { approve, reject, cancel, markDuplicate, process, markPaid, suspend, terminate, activate, holdOn, holdOff }

/// The code the API asks for to run [a] on [tab].
String brokerActionCode(BrokerTab tab, BrokerAction a) => switch ((tab, a)) {
      (BrokerTab.commissions, BrokerAction.approve) => 'broker_commissions:approve',
      (BrokerTab.commissions, BrokerAction.reject) => 'broker_commissions:reject',
      (BrokerTab.commissions, BrokerAction.cancel) => 'broker_commissions:cancel',
      (BrokerTab.leads, BrokerAction.approve) => 'broker_leads:approve',
      (BrokerTab.leads, _) => 'broker_leads:reject',
      (BrokerTab.payouts, BrokerAction.approve) => 'broker_payouts:approve',
      (BrokerTab.payouts, BrokerAction.process) => 'broker_payouts:process',
      (BrokerTab.payouts, BrokerAction.markPaid) => 'broker_payouts:pay',
      (BrokerTab.payouts, _) => 'broker_payouts:cancel',
      (BrokerTab.firms, BrokerAction.suspend) => 'brokers:suspend',
      (BrokerTab.firms, BrokerAction.holdOn) => 'brokers:suspend',
      (BrokerTab.firms, BrokerAction.holdOff) => 'brokers:suspend',
      (BrokerTab.firms, BrokerAction.terminate) => 'brokers:terminate',
      (BrokerTab.firms, _) => 'brokers:update',
      _ => '',
    };

/// Codes the API asks for explicitly, even of the admin (two-person actions:
/// money out, a firm's suspension). The admin's role alone does not open them.
const kStrictBrokerCodes = {
  'broker_leads:approve',
  'broker_leads:reject',
  'broker_commissions:approve',
  'broker_commissions:reject',
  'broker_commissions:cancel',
  'broker_payouts:approve',
  'broker_payouts:process',
  'broker_payouts:pay',
  'broker_payouts:cancel',
  'brokers:suspend',
  'brokers:terminate',
};

/// Whether this account may run an action behind [code].
bool canRunBrokerCode(AppRole? role, StaffPermissions perms, String code) =>
    code.isNotEmpty && (perms.has(code) || (role == AppRole.admin && !kStrictBrokerCodes.contains(code)));

/// The actions a row in [status] can take, in the order the buttons show.
List<BrokerAction> brokerActionsFor(BrokerTab tab, String status, {bool hold = false}) => switch (tab) {
      BrokerTab.commissions => switch (status) {
          'PENDING' => [BrokerAction.approve, BrokerAction.reject],
          'APPROVED' => [BrokerAction.cancel],
          _ => const [],
        },
      BrokerTab.leads => status == 'PENDING' ? [BrokerAction.approve, BrokerAction.reject, BrokerAction.markDuplicate] : const [],
      BrokerTab.payouts => switch (status) {
          'DRAFT' => [BrokerAction.approve, BrokerAction.cancel],
          'APPROVED' => [BrokerAction.process, BrokerAction.markPaid, BrokerAction.cancel],
          'PROCESSING' => [BrokerAction.markPaid, BrokerAction.cancel],
          _ => const [],
        },
      BrokerTab.firms => switch (status) {
          'ACTIVE' => [BrokerAction.suspend, hold ? BrokerAction.holdOff : BrokerAction.holdOn, BrokerAction.terminate],
          'SUSPENDED' => [BrokerAction.activate, hold ? BrokerAction.holdOff : BrokerAction.holdOn, BrokerAction.terminate],
          'PENDING' => [BrokerAction.activate, BrokerAction.terminate],
          _ => const [],
        },
      _ => const [],
    };

/// Whether [a] needs a typed reason (the API refuses it without one).
bool brokerActionNeedsReason(BrokerTab tab, BrokerAction a) =>
    a == BrokerAction.reject || (a == BrokerAction.cancel) || (tab == BrokerTab.firms && a == BrokerAction.terminate);

bool brokerActionDestructive(BrokerAction a) => const {BrokerAction.reject, BrokerAction.cancel, BrokerAction.terminate, BrokerAction.suspend}.contains(a);

String brokerActionLabel(AppLocalizations l10n, BrokerAction a) => switch (a) {
      BrokerAction.approve => l10n.brkActApprove,
      BrokerAction.reject => l10n.brkActReject,
      BrokerAction.cancel => l10n.brkActCancel,
      BrokerAction.markDuplicate => l10n.brkActDuplicate,
      BrokerAction.process => l10n.brkActProcess,
      BrokerAction.markPaid => l10n.brkActMarkPaid,
      BrokerAction.suspend => l10n.brkActSuspend,
      BrokerAction.terminate => l10n.brkActTerminate,
      BrokerAction.activate => l10n.brkActActivate,
      BrokerAction.holdOn => l10n.brkActHoldOn,
      BrokerAction.holdOff => l10n.brkActHoldOff,
    };

const kPayoutMethods = ['BANK_TRANSFER', 'CHEQUE', 'CASH', 'OTHER'];

String payoutMethodLabel(AppLocalizations l10n, String m) => switch (m) {
      'BANK_TRANSFER' => l10n.brkPmBank,
      'CHEQUE' => l10n.brkPmCheque,
      'CASH' => l10n.brkPmCash,
      _ => l10n.brkPmOther,
    };

extension BrokerActions on BrokersAdminRepository {
  Future<Result<void>> act(BrokerTab tab, String id, BrokerAction a, {String? reason, String? method, String? reference}) => guardApiCall(() async {
        final dio = dioForActions;
        final base = '${tab.path}/$id';
        Future<void> patch(String p, [Map<String, dynamic>? body]) => dio.patch<void>('$base/$p', data: body ?? const {});
        Future<void> post(String p, [Map<String, dynamic>? body]) => dio.post<void>('$base/$p', data: body ?? const {});
        final r = (reason ?? '').trim();
        switch ((tab, a)) {
          case (BrokerTab.commissions, BrokerAction.approve) || (BrokerTab.leads, BrokerAction.approve) || (BrokerTab.payouts, BrokerAction.approve):
            await patch('approve');
          case (BrokerTab.commissions, BrokerAction.reject) || (BrokerTab.leads, BrokerAction.reject):
            await patch('reject', {'reason': r});
          case (BrokerTab.commissions, BrokerAction.cancel) || (BrokerTab.payouts, BrokerAction.cancel):
            await patch('cancel', {'reason': r});
          case (BrokerTab.leads, BrokerAction.markDuplicate):
            await patch('mark-duplicate', {if (r.isNotEmpty) 'reason': r});
          case (BrokerTab.payouts, BrokerAction.process):
            await patch('process');
          case (BrokerTab.payouts, BrokerAction.markPaid):
            await patch('mark-paid', {'paymentMethod': method ?? 'BANK_TRANSFER', if ((reference ?? '').trim().isNotEmpty) 'paymentReference': reference!.trim()});
          case (BrokerTab.firms, BrokerAction.suspend):
            await post('suspend', {if (r.isNotEmpty) 'reason': r});
          case (BrokerTab.firms, BrokerAction.terminate):
            await post('terminate', {'reason': r});
          case (BrokerTab.firms, BrokerAction.activate):
            await patch('status', {'status': 'ACTIVE'});
          case (BrokerTab.firms, BrokerAction.holdOn) || (BrokerTab.firms, BrokerAction.holdOff):
            await post('payout-hold', {'hold': a == BrokerAction.holdOn, if (r.isNotEmpty) 'reason': r});
          default:
            throw StateError('no such action $a on $tab');
        }
      });
}

/// One label/value fact on a detail sheet.
typedef BrokerFact = (String, String);

List<BrokerFact> brokerFacts(AppLocalizations l10n, BrokerTab tab, Map<String, dynamic> j, String lang, String symbol) {
  String s(Object? v) => v is String ? v : '';
  Map<String, dynamic> m(Object? v) => v is Map<String, dynamic> ? v : const {};
  String money(Object? v) {
    final n = readAmount(v);
    return n == null ? '' : '${homeCompactText(n, l10n)} $symbol';
  }

  String date(Object? v) {
    final d = DateTime.tryParse(s(v))?.toLocal();
    return d == null ? '' : DateFormatter.mediumDate(d, languageCode: lang);
  }

  String pct(Object? v) {
    final n = readAmount(v);
    return n == null ? '' : ltr('${n.toStringAsFixed(n % 1 == 0 ? 0 : 1)}%');
  }

  final broker = m(j['broker']);
  final brokerName = s(broker['commercialName']).isNotEmpty ? s(broker['commercialName']) : s(broker['companyName']);
  final facts = <BrokerFact>[];
  void add(String label, String value) {
    if (value.isNotEmpty) facts.add((label, value));
  }

  switch (tab) {
    case BrokerTab.firms:
      add(l10n.brkFEmail, s(j['email']));
      add(l10n.brkFPhone, ltr(s(j['phone'])));
      add(l10n.brkFCity, s(j['city']));
      add(l10n.brkFCommission, pct(j['defaultCommissionPct']));
      final start = date(j['contractStartAt']);
      final end = date(j['contractEndAt']);
      add(l10n.brkFContractPeriod, [start, end].where((e) => e.isNotEmpty).join(' – '));
      add(l10n.brkFBank, [s(j['bankName']), ltr(s(j['bankIban']))].where((e) => e.isNotEmpty).join(' · '));
      add(l10n.brkFNotes, s(j['notes']));
    case BrokerTab.leads:
      add(l10n.brkFBroker, brokerName);
      add(l10n.brkFAgent, s(m(j['brokerAgent'])['fullName']));
      add(l10n.brkFPhone, ltr(s(j['phone'])));
      add(l10n.brkFEmail, s(j['email']));
      final p = m(j['projectInterest'])['name'];
      add(l10n.brkFProject, p == null ? '' : Translatable.fromJson(p).resolve(lang));
      add(l10n.brkFUnit, ltr(s(m(j['unitInterest'])['code'])));
      add(l10n.brkFAssigned, s(m(j['assignedSales'])['fullName']));
      add(l10n.brkFSubmitted, date(j['brokerSubmittedAt'] ?? j['createdAt']));
      add(l10n.brkFReason, s(j['brokerRejectionReason']));
    case BrokerTab.reservations:
      add(l10n.brkFBroker, brokerName);
      add(l10n.brkFAgent, s(m(j['brokerAgent'])['fullName']));
      add(l10n.brkFUnit, ltr(s(m(j['unit'])['code'])));
      add(l10n.brkFCustomer, s(m(j['client'])['fullName']));
      add(l10n.brkFBooking, money(j['bookingAmount']));
      add(l10n.brkFCommission, pct(j['commissionLockedPct']));
      add(l10n.brkFExpires, date(j['expiresAt']));
      add(l10n.brkFReason, s(j['reason']));
    case BrokerTab.contracts:
      add(l10n.brkFBroker, brokerName);
      add(l10n.brkFAgent, s(m(j['brokerAgent'])['fullName']));
      add(l10n.brkFUnit, ltr(s(m(j['unit'])['code'])));
      add(l10n.brkFCustomer, s(m(j['customer'])['fullName']));
      add(l10n.brkFTotal, money(j['totalAmount']));
      add(l10n.brkFDown, money(j['downPayment']));
      add(l10n.brkFSigned, date(j['signedAt']));
    case BrokerTab.commissions:
      add(l10n.brkFBroker, brokerName);
      add(l10n.brkFAgent, s(m(j['brokerAgent'])['fullName']));
      add(l10n.brkFBasis, money(j['basisAmount']));
      add(l10n.brkFCommission, pct(j['commissionPct']));
      add(l10n.brkFGross, money(j['grossAmount']));
      add(l10n.brkFTax, money(j['taxAmount']));
      add(l10n.brkFWithholding, money(j['withholdingAmount']));
      add(l10n.brkFNet, money(j['netAmount']));
      add(l10n.brkFEarned, date(j['earnedAt']));
      add(l10n.brkFReason, s(j['rejectionReason']));
    case BrokerTab.payouts:
      add(l10n.brkFBroker, brokerName);
      add(l10n.brkFPeriod, s(j['period']));
      add(l10n.brkFGross, money(j['totalGross']));
      add(l10n.brkFTax, money(j['totalTax']));
      add(l10n.brkFWithholding, money(j['totalWithholding']));
      add(l10n.brkFNet, money(j['totalNet']));
      final method = s(j['paymentMethod']);
      add(l10n.brkFMethod, method.isEmpty ? '' : payoutMethodLabel(l10n, method));
      add(l10n.brkFReference, ltr(s(j['paymentReference'])));
  }
  return facts;
}

/// The detail sheet of a row: its facts, and the buttons the account may use.
/// Returns true when something changed (the list reloads).
Future<bool> showBrokerDetail(
  BuildContext context, {
  required BrokerTab tab,
  required BrokerRow row,
  required BrokersAdminRepository repository,
  required bool Function(String code) can,
}) async {
  final changed = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _DetailSheet(tab: tab, row: row, repository: repository, can: can),
  );
  return changed ?? false;
}

class _DetailSheet extends StatefulWidget {
  const _DetailSheet({required this.tab, required this.row, required this.repository, required this.can});
  final BrokerTab tab;
  final BrokerRow row;
  final BrokersAdminRepository repository;
  final bool Function(String code) can;

  @override
  State<_DetailSheet> createState() => _DetailSheetState();
}

class _DetailSheetState extends State<_DetailSheet> {
  bool _busy = false;

  Future<void> _run(BrokerAction a) async {
    final l10n = context.l10n;
    String? reason;
    String? method;
    String? reference;
    if (brokerActionNeedsReason(widget.tab, a) || a == BrokerAction.markDuplicate || a == BrokerAction.suspend) {
      final required = brokerActionNeedsReason(widget.tab, a);
      reason = await _askText(context, title: brokerActionLabel(l10n, a), hint: l10n.brkReasonHint, required: required);
      if (reason == null) return;
    } else if (a == BrokerAction.markPaid) {
      final picked = await _askPayment(context);
      if (picked == null) return;
      method = picked.$1;
      reference = picked.$2;
    } else {
      final ok = await _askConfirm(
        context,
        icon: _actionIcon(a),
        title: brokerActionLabel(l10n, a),
        subject: widget.row.title,
        danger: brokerActionDestructive(a),
      );
      if (!ok) return;
    }
    if (!mounted) return;
    setState(() => _busy = true);
    final r = await widget.repository.act(widget.tab, widget.row.id, a, reason: reason, method: method, reference: reference);
    if (!mounted) return;
    setState(() => _busy = false);
    if (r is Err) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.brkActionFailed)));
      return;
    }
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final symbol = PriceFormatter.symbol(lang);
    final facts = brokerFacts(l10n, widget.tab, widget.row.raw, lang, symbol);
    final actions = [
      for (final a in brokerActionsFor(widget.tab, widget.row.status, hold: widget.row.raw['payoutHold'] == true))
        if (widget.can(brokerActionCode(widget.tab, a))) a,
    ];
    // One main action on top; the rest, and every risky one, below it in pairs.
    final main = actions.where((a) => !brokerActionDestructive(a)).firstOrNull;
    final others = [for (final a in actions) if (a != main) a];
    final color = brokerStatusColor(widget.row.status, colors);
    final maxH = MediaQuery.sizeOf(context).height * 0.88;
    return Container(
      key: const Key('broker-detail'),
      constraints: BoxConstraints(maxHeight: maxH),
      decoration: BoxDecoration(color: colors.canvas, borderRadius: const BorderRadius.vertical(top: Radius.circular(28))),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(AppSpacing.md, 10, AppSpacing.md, 18),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Center(child: Container(width: 42, height: 4, decoration: BoxDecoration(color: colors.hairline, borderRadius: BorderRadius.circular(4)))),
            const SizedBox(height: 16),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(color: AppPalette.gold50, border: Border.all(color: AppPalette.gold100), borderRadius: BorderRadius.circular(15)),
                child: Icon(brokerTabIcon(widget.tab), size: 23, color: AppPalette.gold500),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(widget.row.title, style: homeDisplay(19, colors.inkStrong)),
                  if (widget.row.subtitle.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(widget.row.subtitle, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
                  ],
                  const SizedBox(height: 7),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(9)),
                    child: Text(brokerStatusLabel(l10n, widget.row.status), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
                  ),
                ]),
              ),
              IconButton(
                tooltip: l10n.actionClose,
                onPressed: () => Navigator.of(context).pop(false),
                icon: Icon(Icons.close_rounded, color: colors.inkMuted),
              ),
            ]),
            if (facts.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                decoration: homeCard(context, radius: 20),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                child: Column(children: [
                  for (var i = 0; i < facts.length; i++) ...[
                    if (i > 0) Divider(height: 1, color: colors.hairline),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        SizedBox(width: 112, child: Text(facts[i].$1, style: TextStyle(fontSize: 12.5, color: colors.inkMuted))),
                        Expanded(child: Text(facts[i].$2, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong))),
                      ]),
                    ),
                  ],
                ]),
              ),
            ],
            if (main != null) ...[
              const SizedBox(height: 18),
              AppButton(
                key: Key('broker-act-${main.name}'),
                label: brokerActionLabel(context.l10n, main),
                icon: _actionIcon(main),
                variant: AppButtonVariant.gold,
                expand: true,
                isLoading: _busy,
                onPressed: _busy ? null : () => _run(main),
              ),
            ],
            if (others.isNotEmpty) ...[
              SizedBox(height: main != null ? 10 : 18),
              LayoutBuilder(builder: (context, c) {
                final w = others.length == 1 ? c.maxWidth : (c.maxWidth - 8) / 2;
                return Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final a in others)
                    SizedBox(
                      width: w,
                      child: _SecondaryAction(
                        key: Key('broker-act-${a.name}'),
                        icon: _actionIcon(a),
                        label: brokerActionLabel(l10n, a),
                        danger: brokerActionDestructive(a),
                        onTap: _busy ? null : () => _run(a),
                      ),
                    ),
                ]);
              }),
            ],
          ]),
        ),
      ),
    );
  }
}

IconData _actionIcon(BrokerAction a) => switch (a) {
      BrokerAction.approve => Icons.check_circle_outline_rounded,
      BrokerAction.reject => Icons.highlight_off_rounded,
      BrokerAction.cancel => Icons.block_rounded,
      BrokerAction.markDuplicate => Icons.content_copy_rounded,
      BrokerAction.process => Icons.play_circle_outline_rounded,
      BrokerAction.markPaid => Icons.payments_rounded,
      BrokerAction.suspend => Icons.pause_circle_outline_rounded,
      BrokerAction.terminate => Icons.gavel_rounded,
      BrokerAction.activate => Icons.verified_outlined,
      BrokerAction.holdOn => Icons.lock_outline_rounded,
      BrokerAction.holdOff => Icons.lock_open_rounded,
    };

/// A compact outlined action; red for those that end or refuse something.
class _SecondaryAction extends StatelessWidget {
  const _SecondaryAction({super.key, required this.icon, required this.label, required this.danger, required this.onTap});
  final IconData icon;
  final String label;
  final bool danger;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final fg = danger ? colors.error : colors.ink;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Container(
        height: 46,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: danger ? colors.error.withValues(alpha: 0.06) : colors.surface,
          border: Border.all(color: danger ? colors.error.withValues(alpha: 0.35) : colors.hairline),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 18, color: fg),
          const SizedBox(width: 6),
          Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: fg))),
        ]),
      ),
    );
  }
}

/// The look every question of this page shares: a rounded sheet with an icon
/// and a title, what to fill, then the main button and cancel.
Future<T?> _showQuestion<T>(
  BuildContext context, {
  required IconData icon,
  required String title,
  String? subject,
  required Widget Function(BuildContext, StateSetter) body,
  required String confirmLabel,
  required bool Function() canConfirm,
  required T Function() result,
  bool danger = false,
}) {
  final l10n = context.l10n;
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => StatefulBuilder(builder: (sheetContext, setS) {
      final colors = sheetContext.appColors;
      final accent = danger ? colors.error : AppPalette.gold500;
      return Container(
        key: const Key('broker-question'),
        padding: EdgeInsets.fromLTRB(AppSpacing.md, 10, AppSpacing.md, MediaQuery.viewInsetsOf(sheetContext).bottom + MediaQuery.paddingOf(sheetContext).bottom + 18),
        decoration: BoxDecoration(color: colors.canvas, borderRadius: const BorderRadius.vertical(top: Radius.circular(28))),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Center(child: Container(width: 42, height: 4, decoration: BoxDecoration(color: colors.hairline, borderRadius: BorderRadius.circular(4)))),
          const SizedBox(height: 16),
          Row(children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(color: accent.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(15)),
              child: Icon(icon, size: 23, color: accent),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: homeDisplay(19, colors.inkStrong)),
                if (subject != null && subject.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(subject, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
                ],
              ]),
            ),
          ]),
          const SizedBox(height: 16),
          body(sheetContext, setS),
          const SizedBox(height: 18),
          if (danger)
            _DangerButton(
              key: const Key('broker-question-ok'),
              label: confirmLabel,
              onTap: canConfirm() ? () => Navigator.of(sheetContext).pop(result()) : null,
            )
          else
            AppButton(
              key: const Key('broker-question-ok'),
              label: confirmLabel,
              variant: AppButtonVariant.gold,
              expand: true,
              onPressed: canConfirm() ? () => Navigator.of(sheetContext).pop(result()) : null,
            ),
          const SizedBox(height: 8),
          AppButton(
            key: const Key('broker-question-cancel'),
            label: l10n.actionCancel,
            variant: AppButtonVariant.outline,
            expand: true,
            onPressed: () => Navigator.of(sheetContext).pop(),
          ),
        ]),
      );
    }),
  );
}

class _DangerButton extends StatelessWidget {
  const _DangerButton({super.key, required this.label, required this.onTap});
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Opacity(
      opacity: onTap == null ? 0.45 : 1,
      child: Material(
        color: colors.error,
        borderRadius: BorderRadius.circular(26),
        child: InkWell(
          borderRadius: BorderRadius.circular(26),
          onTap: onTap,
          child: SizedBox(height: 52, child: Center(child: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)))),
        ),
      ),
    );
  }
}

/// A plain «are you sure»; true when confirmed.
Future<bool> _askConfirm(BuildContext context, {required IconData icon, required String title, required String subject, required bool danger}) async {
  final ok = await _showQuestion<bool>(
    context,
    icon: icon,
    title: title,
    subject: subject,
    body: (_, _) => Text(context.l10n.brkConfirmHint, style: TextStyle(fontSize: 13.5, height: 1.6, color: context.appColors.ink)),
    confirmLabel: title,
    canConfirm: () => true,
    result: () => true,
    danger: danger,
  );
  return ok ?? false;
}

/// A short typed reason; null when cancelled.
Future<String?> _askText(BuildContext context, {required String title, required String hint, required bool required, bool danger = true}) {
  final ctrl = TextEditingController();
  return _showQuestion<String>(
    context,
    icon: Icons.edit_note_rounded,
    title: title,
    body: (ctx, setS) => AppTextField(
      key: const Key('broker-reason'),
      controller: ctrl,
      hint: hint,
      maxLines: 3,
      onChanged: (_) => setS(() {}),
    ),
    confirmLabel: title,
    canConfirm: () => !required || ctrl.text.trim().isNotEmpty,
    result: () => ctrl.text.trim(),
    danger: danger,
  );
}

/// How a payout was paid, and a reference; null when cancelled.
Future<(String, String)?> _askPayment(BuildContext context) {
  final l10n = context.l10n;
  final ref = TextEditingController();
  var method = 'BANK_TRANSFER';
  return _showQuestion<(String, String)>(
    context,
    icon: Icons.payments_rounded,
    title: l10n.brkActMarkPaid,
    body: (ctx, setS) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(l10n.brkFMethod, style: TextStyle(fontSize: 12.5, color: ctx.appColors.inkMuted)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final m in kPayoutMethods)
          ChoiceChip(
            key: Key('broker-pm-$m'),
            label: Text(payoutMethodLabel(l10n, m)),
            selected: method == m,
            showCheckmark: false,
            selectedColor: AppPalette.gold100,
            onSelected: (_) => setS(() => method = m),
          ),
      ]),
      const SizedBox(height: 14),
      AppTextField(key: const Key('broker-pay-ref'), controller: ref, label: l10n.brkFReference),
    ]),
    confirmLabel: l10n.brkActMarkPaid,
    canConfirm: () => true,
    result: () => (method, ref.text.trim()),
  );
}
