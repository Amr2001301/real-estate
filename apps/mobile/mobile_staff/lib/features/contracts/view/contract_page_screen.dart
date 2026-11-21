import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../payments_review/domain/entities/payment_review_item.dart';
import '../../payments_review/presentation/widgets/payment_review_tile.dart' show paymentMethodLabel;
import 'contract_actions.dart';
import 'contracts_data.dart';
import 'contracts_list_screen.dart' show contractBadge, contractMoney;

/// A contract's page (owner-approved design, 2026-11-04), as the website's
/// contract page: the number, its signature and source; the value, what is
/// collected (and how much of it), what remains and what is late; then the
/// overview (the contract's data, the parties, the next instalments, the
/// statement's totals, the documents), every instalment, the statement and
/// the payments. The admin records a payment for the next instalment.
class ContractPageScreen extends StatefulWidget {
  const ContractPageScreen({super.key});

  @override
  State<ContractPageScreen> createState() => _ContractPageScreenState();
}

enum _Tab { overview, installments, statement, payments }

class _ContractPageScreenState extends State<ContractPageScreen> {
  _Tab _tab = _Tab.overview;

  @override
  void initState() {
    super.initState();
    context.read<ContractPageCubit>().load();
  }

  Future<void> _record(ContractPage p, ContractInstallment i) async {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final recorded = await context.push<bool>('/deposits/record', extra: {
      'contractId': p.row.id,
      'installmentId': i.id,
      'amount': i.amount ?? 0.0,
      'label': [_installmentTitle(l10n, p, i), if (i.dueDate != null) DateFormatter.mediumDate(i.dueDate!, languageCode: lang)].join('  ·  '),
    });
    if (recorded == true && mounted) await context.read<ContractPageCubit>().load();
  }

  Future<void> _handover(ContractPage p) async {
    final ok = await showHandoverSheet(context, repository: ContractActionsRepository(context.read<Dio>()), contractId: p.row.id);
    if (ok && mounted) await context.read<ContractPageCubit>().load();
  }

  Future<void> _cancel(ContractPage p) async {
    final ok = await showCancelContractSheet(context, repository: ContractActionsRepository(context.read<Dio>()), contractId: p.row.id);
    if (ok && mounted) await context.read<ContractPageCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final admin = context.read<SessionCubit>().state.role == AppRole.admin;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<ContractPageCubit, DataState<ContractPage>>(
          builder: (context, state) {
            final p = state.data;
            if (p == null) {
              return Column(children: [
                const HomeListHero(title: '', back: true),
                Expanded(
                  child: state.status == DataStatus.failure
                      ? ErrorState(failure: state.failure, onRetry: context.read<ContractPageCubit>().load)
                      : const KitDetailSkeleton(heroHeight: 0, facts: 6),
                ),
              ]);
            }
            final next = p.nextUnpaid;
            final today = homeDay(DateTime.now());
            final late = p.lateCount(today);
            return Column(children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: context.read<ContractPageCubit>().load,
                  child: ListView(padding: EdgeInsets.zero, children: [
                    _hero(context, p, late),
                    DvTabs<_Tab>(
                      keyPrefix: 'contract-tab',
                      selected: _tab,
                      onChanged: (t) => setState(() => _tab = t),
                      tabs: [
                        (_Tab.overview, l10n.kcTabOverview, null, false),
                        (_Tab.installments, l10n.kcTabInstallments, late > 0 ? late : null, late > 0),
                        (_Tab.statement, l10n.kcTabStatement, null, false),
                        (_Tab.payments, l10n.kcTabPayments, p.payments.isEmpty ? null : p.payments.length, false),
                      ],
                    ),
                    Column(children: switch (_tab) {
                        _Tab.overview => _overview(context, p, admin),
                        _Tab.installments => [
                            HomeSection(
                              icon: Icons.event_note_rounded,
                              title: l10n.kcTabInstallments,
                              child: _Installments(page: p, rows: p.installments, admin: admin, onRecord: (i) => _record(p, i)),
                            ),
                          ],
                        _Tab.statement => [HomeSection(icon: Icons.receipt_long_rounded, title: l10n.kcStatement, child: _Statement(page: p, full: true))],
                        _Tab.payments => [HomeSection(icon: Icons.payments_rounded, title: l10n.kcPayments, child: _Payments(page: p))],
                      }),
                  ]),
                ),
              ),
              if (admin && next != null && !p.row.cancelled)
                Container(
                  padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.paddingOf(context).bottom),
                  decoration: BoxDecoration(color: context.appColors.canvas, border: Border(top: BorderSide(color: context.appColors.hairline))),
                  child: SizedBox(
                    width: double.infinity,
                    child: DvGoldButton(
                      key: const Key('contract-record'),
                      height: 50,
                      icon: Icons.payments_rounded,
                      label: l10n.kcRecordPayment,
                      onTap: () => _record(p, next),
                    ),
                  ),
                ),
            ]);
          },
        ),
      ),
    );
  }

  Widget _hero(BuildContext context, ContractPage p, int late) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final r = p.row;
    final signed = r.signedAt != null && !r.cancelled;
    final overdue = late > 0 || p.overdue > 0.005;
    return HomeListHero(
      back: true,
      title: ltr(r.displayNumber),
      badge: signed ? DvHeroBadge(l10n.kcSignedOn(DateFormatter.dayMonth(r.signedAt!, languageCode: lang))) : contractBadge(l10n, r),
      subtitle: [
        if ((r.customerName ?? '').isNotEmpty) r.customerName!,
        if ((r.projectName ?? '').isNotEmpty) r.projectName!,
        if ((r.unitCode ?? '').isNotEmpty) ltr(r.unitCode!),
      ].join(' · '),
      bottom: DvHeroFigure(
        label: l10n.kcCollectedOfValue,
        value: contractMoney(p.paid),
        unit: l10n.kcOfValue('${contractMoney(p.value)} $currency'),
        valueKey: const Key('contract-value'),
        progress: p.collectedPct / 100,
        facts: [
          DvHeroFact('${p.collectedPct}%', l10n.rpCollected, id: 'contract-collected'),
          DvHeroFact(contractMoney(p.remaining), l10n.kcRemaining),
          DvHeroFact(
            overdue ? (p.overdue > 0.005 ? contractMoney(p.overdue) : l10n.kcOverdueN(late)) : l10n.kcNoOverdue,
            l10n.kcOverdue,
            alert: overdue,
            id: 'contract-overdue',
          ),
        ],
      ),
    );
  }

  List<Widget> _overview(BuildContext context, ContractPage p, bool admin) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    String day(DateTime? d) => d == null ? '—' : DateFormatter.mediumDate(d, languageCode: lang);
    final upcoming = p.installments.where((i) => !i.paid).take(3).toList();
    final shown = upcoming.isEmpty ? p.installments.take(3).toList() : upcoming;
    return [
      HomeSection(
        icon: Icons.description_rounded,
        title: l10n.kcData,
        child: DvInfoCard(rows: [
          DvInfo(l10n.kcSignedAt, p.row.signedAt == null ? l10n.kcNotSigned : day(p.row.signedAt)),
          DvInfo(l10n.kcDelivery, [day(p.expectedDelivery), if (p.delayDays > 0) l10n.kcDelayDays(p.delayDays)].join(' · '),
              color: p.delayDays > 0 ? colors.error : null),
          DvInfo(l10n.kcPlan, p.row.planMonths == null ? l10n.kcNoPlan : l10n.kcPlanMonthlyN(p.row.planMonths!)),
          DvInfo(l10n.kcInstallment, p.row.planMonthly == null ? '—' : '${contractMoney(p.row.planMonthly!)} $currency'),
          DvInfo(l10n.kcStarts, day(p.planStarts)),
          DvInfo(l10n.upProject, p.row.projectName ?? '—'),
          DvInfo(
            l10n.kcSource,
            p.row.reservationNumber == null ? l10n.kcManual : l10n.kcFromReservation(ltr(p.row.reservationNumber!)),
          ),
        ]),
      ),
      HomeSection(
        icon: Icons.groups_rounded,
        title: l10n.kcParties,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
          decoration: homeCard(context, radius: 22),
          child: Column(children: [
            ContractParty(label: l10n.kcClient, name: p.row.customerName ?? '—', phone: p.row.customerPhone),
            if ((p.salesName ?? '').isNotEmpty) ...[Divider(height: 1, color: colors.hairline), ContractParty(label: l10n.kcSales, name: p.salesName!)],
            if ((p.brokerName ?? '').isNotEmpty) ...[
              Divider(height: 1, color: colors.hairline),
              ContractParty(label: l10n.kcBroker, name: [p.brokerName!, if ((p.brokerAgentName ?? '').isNotEmpty) p.brokerAgentName!].join(' · '), icon: Icons.handshake_rounded),
            ],
          ]),
        ),
      ),
      HomeSection(
        icon: Icons.event_note_rounded,
        title: l10n.kcNextInstallments,
        action: p.installments.length > shown.length ? l10n.kcAllInstallmentsN(p.installments.length) : null,
        onAction: () => setState(() => _tab = _Tab.installments),
        child: _Installments(page: p, rows: shown, admin: admin, onRecord: (i) => _record(p, i)),
      ),
      HomeSection(
        icon: Icons.receipt_long_rounded,
        title: l10n.kcStatement,
        action: p.lines.isEmpty ? null : l10n.kcFullStatement,
        onAction: () => setState(() => _tab = _Tab.statement),
        child: _Statement(page: p, full: false),
      ),
      HomeSection(
        icon: Icons.folder_rounded,
        title: l10n.kcDocuments,
        child: DvActionCard(actions: [
          if ((p.pdfUrl ?? '').isNotEmpty)
            DvAction(
              id: 'contract-pdf',
              icon: Icons.picture_as_pdf_rounded,
              title: l10n.kcContractPdf,
              subtitle: ltr('${p.row.displayNumber}.pdf'),
              onTap: () => ContactActions.openExternal(p.pdfUrl!),
            ),
          DvAction(
            id: 'contract-documents',
            icon: Icons.folder_open_rounded,
            title: l10n.kcAllDocuments,
            onTap: () => context.push(
              '/documents-view?ownerType=CONTRACT&ownerId=${p.row.id}&title=${Uri.encodeComponent(l10n.contractsDocumentsTitle)}',
            ),
          ),
        ]),
      ),
      if (admin && !p.row.cancelled)
        HomeSection(
          icon: Icons.settings_suggest_rounded,
          title: l10n.ctaSection,
          child: DvActionCard(actions: [
            if (p.row.signedAt != null && !p.handedOver)
              DvAction(id: 'contract-handover', icon: Icons.key_rounded, title: l10n.ctaHandover, subtitle: l10n.ctaHandoverDesc, onTap: () => _handover(p)),
            DvAction(
              id: 'contract-cancel',
              icon: Icons.block_rounded,
              title: l10n.ctaCancelContract,
              subtitle: l10n.ctaCancelDesc,
              danger: true,
              onTap: () => _cancel(p),
            ),
          ]),
        ),
      const SizedBox(height: 10),
    ];
  }
}

String _installmentTitle(AppLocalizations l10n, ContractPage p, ContractInstallment i) {
  if (i.type == 'DOWN_PAYMENT') return l10n.kcDownPayment;
  if (i.type == 'INSTALLMENT') {
    final plan = p.installments.where((x) => x.type == 'INSTALLMENT').toList();
    return l10n.kcInstallmentNOf(plan.indexOf(i) + 1, plan.length);
  }
  return l10n.kcInstallment;
}

/// Facts as rows: the label at the start, the value at the end.
class KvTable extends StatelessWidget {
  const KvTable({super.key, required this.rows});
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) => DvInfoCard(rows: [for (final (k, v) in rows) DvInfo(k, v)]);
}

class ContractParty extends StatelessWidget {
  const ContractParty({super.key, required this.label, required this.name, this.phone, this.icon});
  final String label;
  final String name;
  final String? phone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final has = (phone ?? '').isNotEmpty;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(children: [
        Container(
          width: 42,
          height: 42,
          alignment: Alignment.center,
          decoration: const BoxDecoration(color: Color(0xFF0B1426), shape: BoxShape.circle),
          child: icon != null ? Icon(icon, size: 18, color: const Color(0xFFEED7A0)) : Text(homeInitials(name), style: homeDisplay(14, const Color(0xFFEED7A0))),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
            const SizedBox(height: 2),
            Text(name, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: colors.inkStrong)),
            if (has) Text(ltr(phone!), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          ]),
        ),
        if (has) ...[
          DvSquareAction(key: const Key('contract-whatsapp'), icon: Icons.chat_rounded, color: const Color(0xFF1E7A55), onTap: () => ContactActions.whatsApp(number: phone!)),
          const SizedBox(width: 8),
          DvSquareAction(key: const Key('contract-call'), icon: Icons.call_rounded, gold: true, onTap: () => ContactActions.call(phone!)),
        ],
      ]),
    );
  }
}

class _Installments extends StatelessWidget {
  const _Installments({required this.page, required this.rows, required this.admin, required this.onRecord});
  final ContractPage page;
  final List<ContractInstallment> rows;
  final bool admin;
  final ValueChanged<ContractInstallment> onRecord;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final today = homeDay(DateTime.now());
    if (rows.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: homeCard(context, radius: 22),
        child: Text(l10n.kcNoInstallments, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
      );
    }
    final currency = PriceFormatter.symbol(lang);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      decoration: homeCard(context, radius: 22),
      child: Column(children: [
        for (final (n, i) in rows.indexed) ...[
          if (n > 0) Divider(height: 1, color: colors.hairline),
          Padding(
            key: Key('contract-inst-${i.id}'),
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(children: [
              DvDateBox(date: i.dueDate, alert: !i.paid && i.late(today)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_installmentTitle(l10n, page, i), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.inkStrong)),
                  const SizedBox(height: 5),
                  i.paid
                      ? DvPill(l10n.kcPaid, tone: DvTone.ok, small: true)
                      : i.awaiting
                          ? DvPill(l10n.kcAwaiting, tone: DvTone.warn, small: true)
                          : i.late(today)
                              ? DvPill(l10n.kcLate, tone: DvTone.bad, small: true)
                              : DvPill(l10n.kcUpcoming, small: true),
                ]),
              ),
              if (i.amount != null)
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(contractMoney(i.amount!), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                  Text(currency, style: TextStyle(fontSize: 11.5, color: colors.inkMuted)),
                ]),
              if (admin && !i.paid && !i.awaiting) ...[
                const SizedBox(width: 8),
                DvSquareAction(
                  key: Key('contract-inst-record-${i.id}'),
                  icon: Icons.add_rounded,
                  color: AppPalette.gold600,
                  tooltip: l10n.kcRecordPayment,
                  onTap: () => onRecord(i),
                ),
              ],
            ]),
          ),
        ],
      ]),
    );
  }
}

class _Statement extends StatelessWidget {
  const _Statement({required this.page, required this.full});
  final ContractPage page;
  final bool full;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    String lineLabel(ContractStatementLine l) => switch ((l.kind, l.rowType)) {
          ('CONTRACT', _) => l10n.kcLineContract,
          ('PAYMENT', 'BOOKING') => l10n.kcLineBooking,
          ('PAYMENT', 'DOWN_PAYMENT') => '${l10n.kcLinePayment} · ${l10n.kcDownPayment}',
          ('PAYMENT', _) => l10n.kcLinePayment,
          ('FEE', _) => l10n.kcLineFee,
          ('REFUND', _) => l10n.kcLineRefund,
          (final k, _) => k,
        };
    return Column(children: [
      DvInfoCard(rows: [
        DvInfo(l10n.kcLineContract, contractMoney(page.value)),
        DvInfo(l10n.kcStPaid, contractMoney(page.paid), color: catalogAvailable, id: 'statement-paid'),
        DvInfo(l10n.kcStBalance, contractMoney(page.remaining), strong: true),
        DvInfo(l10n.kcStOverdue, contractMoney(page.overdue), color: page.overdue > 0.005 ? colors.error : null),
        if (page.openFees > 0.005) DvInfo(l10n.kcStFees, contractMoney(page.openFees)),
      ]),
      if (full && page.lines.isNotEmpty) ...[
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          decoration: homeCard(context, radius: 22),
          child: Column(children: [
            for (final (n, l) in page.lines.indexed) ...[
              if (n > 0) Divider(height: 1, color: colors.hairline),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 9),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(lineLabel(l), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                      Text(
                        [
                          if (l.date != null) DateFormatter.mediumDate(l.date!, languageCode: lang),
                          ?paymentMethodLabel(l10n, PaymentMethod.fromWire(l.method)),
                        ].join(' · '),
                        style: TextStyle(fontSize: 12, color: colors.inkMuted),
                      ),
                    ]),
                  ),
                  Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text(
                      ltr(l.credit > 0 ? '− ${contractMoney(l.credit)}' : '+ ${contractMoney(l.debit)}'),
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: l.credit > 0 ? catalogAvailable : colors.inkStrong),
                    ),
                    Text(ltr(contractMoney(l.balance)), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                  ]),
                ]),
              ),
            ],
          ]),
        ),
      ],
    ]);
  }
}

class _Payments extends StatelessWidget {
  const _Payments({required this.page});
  final ContractPage page;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    if (page.payments.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: homeCard(context, radius: 22),
        child: Text(l10n.kcNoPayments, style: TextStyle(fontSize: 12.5, color: colors.inkMuted)),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: homeCard(context, radius: 22),
      child: Column(children: [
        for (final (n, d) in page.payments.indexed) ...[
          if (n > 0) Divider(height: 1, color: colors.hairline),
          Padding(
            key: Key('contract-payment-${d.id}'),
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: homeTint(context), borderRadius: BorderRadius.circular(11)),
                child: Icon(Icons.payments_rounded, size: 18, color: AppPalette.gold500),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(d.type == 'DOWN_PAYMENT' ? l10n.kcDownPayment : (d.type == 'BOOKING' ? l10n.kcLineBooking : l10n.kcLinePayment),
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                  Text(
                    [
                      if (d.paidAt != null) DateFormatter.mediumDate(d.paidAt!, languageCode: lang),
                      ?paymentMethodLabel(l10n, PaymentMethod.fromWire(d.method)),
                    ].join(' · '),
                    style: TextStyle(fontSize: 12, color: colors.inkMuted),
                  ),
                ]),
              ),
              if (d.amount != null) Text(contractMoney(d.amount!), style: homeDisplay(14.5, colors.inkStrong)),
            ]),
          ),
        ],
      ]),
    );
  }
}
