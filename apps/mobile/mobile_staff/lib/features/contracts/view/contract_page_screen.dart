import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../payments_review/domain/entities/payment_review_item.dart';
import '../../payments_review/presentation/widgets/payment_review_tile.dart' show paymentMethodLabel;
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
                      : const Center(child: CircularProgressIndicator()),
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
                    HomeOverlap(overlap: 44, top: _Header(page: p), bottom: _Figures(page: p, late: late)),
                    const SizedBox(height: 14),
                    SizedBox(
                        height: 38,
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                          child: Row(children: [
                            for (final (t, label, badge) in [
                              (_Tab.overview, l10n.kcTabOverview, null),
                              (_Tab.installments, l10n.kcTabInstallments, late > 0 ? late : null),
                              (_Tab.statement, l10n.kcTabStatement, null),
                              (_Tab.payments, l10n.kcTabPayments, p.payments.isEmpty ? null : p.payments.length),
                            ]) ...[
                              _TabChip(
                                key: Key('contract-tab-${t.name}'),
                                label: label,
                                badge: badge,
                                alert: t == _Tab.installments && late > 0,
                                selected: _tab == t,
                                onTap: () => setState(() => _tab = t),
                              ),
                              const SizedBox(width: 6),
                            ],
                          ]),
                        ),
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
                  child: FilledButton.icon(
                    key: const Key('contract-record'),
                    onPressed: () => _record(p, next),
                    icon: const Icon(Icons.payments_rounded, size: 19),
                    label: Text(l10n.kcRecordPayment),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      backgroundColor: AppPalette.gold400,
                      foregroundColor: AppPalette.navy,
                      textStyle: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                    ),
                  ),
                ),
            ]);
          },
        ),
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
        child: KvTable(rows: [
          (l10n.kcSignedAt, p.row.signedAt == null ? l10n.kcNotSigned : day(p.row.signedAt)),
          (l10n.kcDelivery, [day(p.expectedDelivery), if (p.delayDays > 0) l10n.kcDelayDays(p.delayDays)].join(' · ')),
          (l10n.kcPlan, p.row.planMonths == null ? l10n.kcNoPlan : l10n.kcPlanMonthlyN(p.row.planMonths!)),
          (l10n.kcInstallment, p.row.planMonthly == null ? '—' : '${contractMoney(p.row.planMonthly!)} $currency'),
          (l10n.kcStarts, day(p.planStarts)),
          (l10n.upProject, p.row.projectName ?? '—'),
        ]),
      ),
      HomeSection(
        icon: Icons.groups_rounded,
        title: l10n.kcParties,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
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
        child: Material(
          color: colors.surface,
          borderRadius: BorderRadius.circular(22),
          child: Container(
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: colors.hairline)),
            child: Column(children: [
              if ((p.pdfUrl ?? '').isNotEmpty) ...[
                ListTile(
                  key: const Key('contract-pdf'),
                  leading: Icon(Icons.picture_as_pdf_rounded, color: AppPalette.gold500),
                  title: Text(l10n.kcContractPdf, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(ltr('${p.row.displayNumber}.pdf')),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => ContactActions.openExternal(p.pdfUrl!),
                ),
                Divider(height: 1, color: colors.hairline),
              ],
              ListTile(
                key: const Key('contract-documents'),
                leading: Icon(Icons.folder_open_rounded, color: AppPalette.gold500),
                title: Text(l10n.kcAllDocuments, style: const TextStyle(fontWeight: FontWeight.w700)),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => context.push(
                  '/documents-view?ownerType=CONTRACT&ownerId=${p.row.id}&title=${Uri.encodeComponent(l10n.contractsDocumentsTitle)}',
                ),
              ),
            ]),
          ),
        ),
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

/// The navy header: back, the number, the client and unit, the badges.
class _Header extends StatelessWidget {
  const _Header({required this.page});
  final ContractPage page;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final r = page.row;
    return HomeListHero(
      title: ltr(r.displayNumber),
      subtitle: [if ((r.customerName ?? '').isNotEmpty) r.customerName!, if ((r.unitCode ?? '').isNotEmpty) ltr(r.unitCode!)].join(' · '),
      back: true,
      bottom: Padding(
        padding: const EdgeInsets.only(bottom: 48),
        child: Wrap(spacing: 6, runSpacing: 6, children: [
          r.signedAt != null && !r.cancelled
              ? CatalogBadge.status(l10n.kcSignedOn(DateFormatter.dayMonth(r.signedAt!, languageCode: lang)), catalogAvailable, icon: Icons.verified_rounded)
              : contractBadge(l10n, r),
          CatalogBadge.glass(r.reservationNumber == null ? l10n.kcManual : l10n.kcFromReservation(ltr(r.reservationNumber!))),
        ]),
      ),
    );
  }
}

/// The floating card: the value and the down payment, what is collected
/// (bar and share), what remains (and the open fees) and what is late.
class _Figures extends StatelessWidget {
  const _Figures({required this.page, required this.late});
  final ContractPage page;
  final int late;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    Widget tile(String k, String v, {Color? bg, Color? border, String? note, Key? key}) => Expanded(
          child: Container(
            key: key,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: bg ?? homeTint(context),
              border: Border.all(color: border ?? homeTintBorder(context)),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(k, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              Text(v, maxLines: 1, overflow: TextOverflow.ellipsis, style: homeDisplay(16, colors.inkStrong)),
              if (note != null) Text(note, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
            ]),
          ),
        );
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: colors.hairline),
        boxShadow: const [BoxShadow(color: Color(0x290E1626), blurRadius: 40, offset: Offset(0, 18))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(l10n.kcValue, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        Text.rich(
          key: const Key('contract-value'),
          TextSpan(children: [
            TextSpan(text: contractMoney(page.value), style: homeDisplay(26, colors.inkStrong)),
            TextSpan(text: ' $currency', style: TextStyle(fontSize: 13, color: colors.inkMuted)),
          ]),
        ),
        if ((page.row.downPayment ?? 0) > 0)
          Text(l10n.kcDown('${contractMoney(page.row.downPayment!)} $currency'), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: page.collectedPct / 100,
            minHeight: 8,
            backgroundColor: colors.surfaceSoft,
            valueColor: AlwaysStoppedAnimation(AppPalette.gold500),
          ),
        ),
        const SizedBox(height: 5),
        Text(l10n.kcCollected('${contractMoney(page.paid)} $currency', ltr('${page.collectedPct}%')),
            key: const Key('contract-collected'), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        const SizedBox(height: 10),
        Row(children: [
          tile(
            l10n.kcRemaining,
            contractMoney(page.remaining),
            note: page.openFees > 0.005 ? l10n.kcPlusFees(contractMoney(page.openFees)) : null,
          ),
          const SizedBox(width: 8),
          late > 0 || page.overdue > 0.005
              ? tile(
                  l10n.kcOverdue,
                  page.overdue > 0.005 ? contractMoney(page.overdue) : l10n.kcOverdueN(late),
                  note: late > 0 && page.overdue > 0.005 ? l10n.kcOverdueN(late) : null,
                  bg: colors.error.withValues(alpha: 0.12),
                  border: colors.error.withValues(alpha: 0.35),
                  key: const Key('contract-overdue'),
                )
              : tile(l10n.kcOverdue, l10n.kcNoOverdue, bg: colors.success.withValues(alpha: 0.12), border: colors.success.withValues(alpha: 0.35), key: const Key('contract-overdue')),
        ]),
      ]),
    );
  }
}

class _TabChip extends StatelessWidget {
  const _TabChip({super.key, required this.label, required this.selected, required this.onTap, this.badge, this.alert = false});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? badge;
  final bool alert;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: selected ? (Theme.of(context).brightness == Brightness.dark ? AppPalette.gold500 : AppPalette.navy) : colors.surface,
      shape: StadiumBorder(side: BorderSide(color: selected ? (Theme.of(context).brightness == Brightness.dark ? AppPalette.gold500 : AppPalette.navy) : colors.hairline)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 13),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: selected ? (Theme.of(context).brightness == Brightness.dark ? AppPalette.navy : Colors.white) : colors.inkStrong)),
            if (badge != null) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: alert ? colors.error.withValues(alpha: 0.14) : colors.surfaceSoft,
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(ltr('$badge'),
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: alert ? colors.error : colors.inkMuted)),
              ),
            ],
          ]),
        ),
      ),
    );
  }
}

/// A two-column table of facts.
class KvTable extends StatelessWidget {
  const KvTable({super.key, required this.rows});
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      decoration: homeCard(context, radius: 22),
      clipBehavior: Clip.antiAlias,
      child: LayoutBuilder(builder: (context, box) {
        final w = box.maxWidth / 2;
        return Wrap(children: [
          for (final (i, (k, v)) in rows.indexed)
            Container(
              width: w,
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
              decoration: BoxDecoration(
                border: BorderDirectional(
                  end: i.isEven ? BorderSide(color: colors.hairline) : BorderSide.none,
                  bottom: i < rows.length - (rows.length.isEven ? 2 : 1) ? BorderSide(color: colors.hairline) : BorderSide.none,
                ),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(k, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                const SizedBox(height: 2),
                Text(v, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
              ]),
            ),
        ]);
      }),
    );
  }
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
    Widget round(IconData i, Color c, VoidCallback onTap, Key key) => Material(
          color: c.withValues(alpha: 0.10),
          shape: const CircleBorder(),
          child: InkWell(
            key: key,
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(width: 34, height: 34, child: Icon(i, size: 17, color: c)),
          ),
        );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(children: [
        Container(
          width: 38,
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(gradient: homeNavyGradient, borderRadius: BorderRadius.circular(12)),
          child: icon != null ? Icon(icon, size: 18, color: AppPalette.gold300) : Text(homeInitials(name), style: homeDisplay(13, AppPalette.gold300)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
            Text(name, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: colors.inkStrong)),
            if ((phone ?? '').isNotEmpty) Text(ltr(phone!), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
          ]),
        ),
        if ((phone ?? '').isNotEmpty) ...[
          round(Icons.chat_rounded, const Color(0xFF1E9E5A), () => ContactActions.whatsApp(number: phone!), const Key('contract-whatsapp')),
          const SizedBox(width: 6),
          round(Icons.call_rounded, AppPalette.navy, () => ContactActions.call(phone!), const Key('contract-call')),
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
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: colors.hairline)),
        child: Column(children: [
          for (final (n, i) in rows.indexed) ...[
            if (n > 0) Divider(height: 1, color: colors.hairline),
            Padding(
              key: Key('contract-inst-${i.id}'),
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(children: [
                SizedBox(
                  width: 44,
                  child: Column(children: [
                    Text(i.dueDate == null ? '—' : ltr('${i.dueDate!.day}'), style: homeDisplay(16, colors.inkStrong)),
                    if (i.dueDate != null) Text(DateFormatter.monthShort(i.dueDate!, languageCode: lang), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                  ]),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_installmentTitle(l10n, page, i), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                    if (i.dueDate != null) Text(ltr('${i.dueDate!.year}'), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
                  ]),
                ),
                if (i.amount != null) Text(contractMoney(i.amount!), style: homeDisplay(14.5, colors.inkStrong)),
                const SizedBox(width: 8),
                i.paid
                    ? CatalogBadge.status(l10n.kcPaid, catalogAvailable)
                    : i.awaiting
                        ? CatalogBadge.status(l10n.kcAwaiting, catalogReserved)
                        : i.late(today)
                            ? CatalogBadge.status(l10n.kcLate, colors.error)
                            : CatalogBadge.status(l10n.kcUpcoming, const Color(0xFF6B6256)),
                if (admin && !i.paid && !i.awaiting)
                  IconButton(
                    key: Key('contract-inst-record-${i.id}'),
                    icon: const Icon(Icons.add_circle_outline_rounded),
                    iconSize: 20,
                    color: AppPalette.gold600,
                    visualDensity: VisualDensity.compact,
                    tooltip: l10n.kcRecordPayment,
                    onPressed: () => onRecord(i),
                  ),
              ]),
            ),
          ],
        ]),
      ),
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
    Widget row(String k, double v, {Color? color, Key? key}) => Padding(
          key: key,
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Row(children: [
            Expanded(child: Text(k, style: TextStyle(fontSize: 12.5, color: colors.inkMuted))),
            Text(contractMoney(v), style: homeDisplay(14, color ?? colors.inkStrong)),
          ]),
        );
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
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: homeCard(context, radius: 22),
        child: Column(children: [
          row(l10n.kcLineContract, page.value),
          Divider(height: 1, color: colors.hairline),
          row(l10n.kcStPaid, page.paid, color: catalogAvailable, key: const Key('statement-paid')),
          Divider(height: 1, color: colors.hairline),
          row(l10n.kcStBalance, page.remaining),
          Divider(height: 1, color: colors.hairline),
          row(l10n.kcStOverdue, page.overdue, color: page.overdue > 0.005 ? colors.error : null),
          if (page.openFees > 0.005) ...[Divider(height: 1, color: colors.hairline), row(l10n.kcStFees, page.openFees)],
        ]),
      ),
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
