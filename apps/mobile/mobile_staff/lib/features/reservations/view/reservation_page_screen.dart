import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../common/reservation_status_label.dart';
import '../../contracts/view/contract_page_screen.dart' show ContractParty, KvTable;
import '../../contracts/view/contracts_list_screen.dart' show contractMoney;
import '../../e_sign/presentation/signature_section.dart';
import '../../payments_review/domain/entities/payment_review_item.dart';
import '../../payments_review/presentation/widgets/payment_review_tile.dart' show paymentMethodLabel;
import '../presentation/screens/reservation_decision_card.dart' show askReservationRejectReason, confirmReservationApprove;
import 'reservations_data.dart';
import 'reservations_list_screen.dart' show reservationBadge, bookingPayLabel;

/// A booking's page (owner-approved design r2, 2026-11-04), as the website's
/// booking page: the number, the state and when it ends; the booking amount
/// and its journey (created, paid, approved, contract); the parties; the
/// plan the booking saved; the customer's signature; the history and
/// notes. The bottom bar holds what the viewer may do next: approve or
/// reject (the admin, or the manager on a teammate's booking); record the
/// booking amount, cancel, or convert to a contract (the admin).
class ReservationPageScreen extends StatefulWidget {
  const ReservationPageScreen({super.key});

  @override
  State<ReservationPageScreen> createState() => _ReservationPageScreenState();
}

class _ReservationPageScreenState extends State<ReservationPageScreen> {
  final _note = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    context.read<ReservationPageCubit>().load();
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _run(Future<Result<void>> Function(ReservationsViewRepository repo, String id) action, String done) async {
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    final f = await context.read<ReservationPageCubit>().act(action);
    if (!mounted) return;
    setState(() => _busy = false);
    messenger.showSnackBar(SnackBar(content: Text(f?.userMessage(l10n) ?? done)));
  }

  Future<void> _approve() async {
    if (!await confirmReservationApprove(context) || !mounted) return;
    await _run((repo, id) => repo.approve(id), context.l10n.rvApprovedMsg);
  }

  Future<void> _reject() async {
    final reason = await askReservationRejectReason(context);
    if (reason == null || !mounted) return;
    await _run((repo, id) => repo.reject(id, reason), context.l10n.rvRejectedMsg);
  }

  Future<void> _cancel() async {
    final l10n = context.l10n;
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.rvCancel),
        content: TextField(
          key: const Key('reservation-cancel-reason'),
          controller: ctrl,
          autofocus: true,
          minLines: 2,
          maxLines: 4,
          decoration: InputDecoration(hintText: l10n.rvCancelReason),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: Text(l10n.rvKeep)),
          FilledButton(
            key: const Key('reservation-cancel-confirm'),
            style: FilledButton.styleFrom(backgroundColor: ctx.appColors.error),
            onPressed: () => ctrl.text.trim().isEmpty ? null : Navigator.of(ctx).pop(ctrl.text.trim()),
            child: Text(l10n.rvCancel),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (reason == null || !mounted) return;
    await _run((repo, id) => repo.cancel(id, reason), l10n.rvCancelledMsg);
  }

  Future<void> _recordPayment() async {
    final l10n = context.l10n;
    final picked = await showModalBottomSheet<(DateTime, String)>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _PaymentSheet(),
    );
    if (picked == null || !mounted) return;
    await _run((repo, id) => repo.confirmPayment(id, paidAt: picked.$1, method: picked.$2), l10n.rvPaidMsg);
  }

  Future<void> _addNote() async {
    final body = _note.text.trim();
    if (body.isEmpty) return;
    final l10n = context.l10n;
    await _run((repo, id) => repo.addNote(id, body), l10n.rvNoteAdded);
    if (mounted) _note.clear();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final session = context.read<SessionCubit>().state;
    final admin = session.role == AppRole.admin;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BlocBuilder<ReservationPageCubit, DataState<ReservationPage>>(
          builder: (context, state) {
            final p = state.data;
            if (p == null) {
              return Column(children: [
                const HomeListHero(title: '', back: true),
                Expanded(
                  child: state.status == DataStatus.failure
                      ? ErrorState(failure: state.failure, onRetry: context.read<ReservationPageCubit>().load)
                      : const Center(child: CircularProgressIndicator()),
                ),
              ]);
            }
            final r = p.row;
            final decides = canDecideBooking(r, role: session.role, userId: session.sessionOrNull?.userId);
            final bar = decides
                ? _Bar(
                    busy: _busy,
                    secondary: (l10n.reservationReject, Icons.close_rounded, _reject, const Key('reservation-reject')),
                    primary: (l10n.reservationApprove, Icons.check_rounded, _approve, const Key('reservation-approve')),
                    primaryColor: catalogAvailable,
                  )
                : admin && r.status == 'APPROVED'
                    ? _Bar(
                        busy: _busy,
                        secondary: (l10n.rvCancel, Icons.cancel_rounded, _cancel, const Key('reservation-cancel')),
                        primary: r.bookingSettled
                            ? (
                                l10n.cvTitle,
                                Icons.description_rounded,
                                () async {
                                  await context.push('/reservations/${r.id}/convert');
                                  if (context.mounted) await context.read<ReservationPageCubit>().load();
                                },
                                const Key('reservation-convert'),
                              )
                            : (l10n.rvRecordPayment, Icons.payments_rounded, _recordPayment, const Key('reservation-record-payment')),
                      )
                    : null;
            return Column(children: [
              Expanded(
                child: RefreshIndicator(
                  onRefresh: context.read<ReservationPageCubit>().load,
                  child: ListView(padding: const EdgeInsets.only(bottom: 20), children: [
                    HomeOverlap(overlap: 44, top: ReservationHeader(page: p), bottom: ReservationBookingCard(page: p)),
                    if (p.contractId != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
                        child: ReservationLinkCard(
                          key: const Key('reservation-contract'),
                          icon: Icons.description_rounded,
                          title: l10n.rvContractN(ltr(p.contractNumber ?? '')),
                          subtitle: r.convertedAt == null ? null : l10n.rvConvertedOn(DateFormatter.mediumDate(r.convertedAt!, languageCode: Localizations.localeOf(context).languageCode)),
                          onTap: () => context.push('/contracts/${p.contractId}'),
                        ),
                      ),
                    HomeSection(
                      icon: Icons.groups_rounded,
                      title: l10n.kcParties,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                        decoration: homeCard(context, radius: 22),
                        child: Column(children: [
                          ContractParty(label: l10n.kcClient, name: r.clientName ?? '—', phone: r.clientPhone),
                          if ((r.salesName ?? '').isNotEmpty) ...[
                            Divider(height: 1, color: context.appColors.hairline),
                            ContractParty(label: l10n.kcSales, name: r.salesName!),
                          ],
                          if (r.viaBroker) ...[
                            Divider(height: 1, color: context.appColors.hairline),
                            ContractParty(label: l10n.kcBroker, name: l10n.rvByBroker, icon: Icons.handshake_rounded),
                          ],
                        ]),
                      ),
                    ),
                    if (p.planName != null || r.months != null) HomeSection(icon: Icons.payments_rounded, title: l10n.kcPlan, child: ReservationPlan(page: p)),
                    if (r.status == 'PENDING' || r.status == 'APPROVED' || r.status == 'CONVERTED')
                      Padding(
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 18, AppSpacing.md, 0),
                        child: SignatureSection(reservationId: r.id, bookingStatus: r.status, customerName: r.clientName),
                      ),
                    HomeSection(
                      icon: Icons.history_rounded,
                      title: l10n.rvHistory,
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        if (p.events.isNotEmpty) ReservationHistory(events: p.events),
                        const SizedBox(height: 10),
                        TextField(
                          key: const Key('reservation-note'),
                          controller: _note,
                          minLines: 1,
                          maxLines: 3,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _addNote(),
                          decoration: InputDecoration(
                            hintText: l10n.leadNoteHint,
                            filled: true,
                            fillColor: Colors.white,
                            isDense: true,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: context.appColors.hairline)),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: context.appColors.hairline)),
                            suffixIcon: IconButton(
                              key: const Key('reservation-note-send'),
                              icon: const Icon(Icons.send_rounded, color: AppPalette.gold600),
                              onPressed: _busy ? null : _addNote,
                            ),
                          ),
                        ),
                      ]),
                    ),
                  ]),
                ),
              ),
              ?bar,
            ]);
          },
        ),
      ),
    );
  }
}

/// The navy header: back, the number, the client and unit, the badges.
class ReservationHeader extends StatelessWidget {
  const ReservationHeader({super.key, required this.page});
  final ReservationPage page;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final r = page.row;
    final left = r.daysLeft(DateTime.now());
    return HomeListHero(
      title: ltr(r.displayNumber),
      subtitle: [if ((r.clientName ?? '').isNotEmpty) r.clientName!, if ((r.unitCode ?? '').isNotEmpty) ltr(r.unitCode!)].join(' · '),
      back: true,
      bottom: Padding(
        padding: const EdgeInsets.only(bottom: 48),
        child: Wrap(spacing: 6, runSpacing: 6, children: [
          reservationBadge(l10n, r),
          if (r.open && left != null && r.expiresAt != null)
            CatalogBadge.glass(left < 0
                ? l10n.rvExpiredOn(DateFormatter.dayMonth(r.expiresAt!, languageCode: lang))
                : '${l10n.rvExpiresInN(left)} · ${DateFormatter.dayMonth(r.expiresAt!, languageCode: lang)}'),
        ]),
      ),
    );
  }
}

/// The floating card: the booking amount and whether it is paid, and the
/// booking's journey to a contract.
class ReservationBookingCard extends StatelessWidget {
  const ReservationBookingCard({super.key, required this.page, this.extra});
  final ReservationPage page;

  /// Something under the amount (the broker's commission).
  final Widget? extra;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final currency = PriceFormatter.symbol(lang);
    final r = page.row;
    String day(DateTime? d) => d == null ? '' : DateFormatter.dayMonth(d, languageCode: lang);
    final closedStep = switch (r.status) {
      'REJECTED' => l10n.rvJRejected,
      'CANCELLED' => l10n.rvJCancelled,
      'EXPIRED' => l10n.rvJExpired,
      _ => null,
    };
    // Each step: label, date, done; the first not done is "now".
    final steps = <(String, DateTime?, bool)>[
      (l10n.rvJCreated, r.createdAt, true),
      (l10n.rvJBooking, r.bookingPaidAt, r.bookingSettled && r.bookingAmount > 0 ? true : r.bookingAmount <= 0),
      (l10n.rvJApproved, r.approvedAt, r.approvedAt != null || r.status == 'CONVERTED'),
      (closedStep ?? l10n.rvJContract, closedStep != null ? r.closedAt : r.convertedAt, r.status == 'CONVERTED'),
    ];
    final now = closedStep == null ? steps.indexWhere((s) => !s.$3) : -1;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFEFE6D4)),
        boxShadow: const [BoxShadow(color: Color(0x290F1E33), blurRadius: 40, offset: Offset(0, 18))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(l10n.rvBooking, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              Text.rich(
                key: const Key('reservation-amount'),
                TextSpan(children: [
                  TextSpan(text: r.bookingAmount <= 0 ? '—' : contractMoney(r.bookingAmount), style: homeDisplay(26, colors.inkStrong)),
                  if (r.bookingAmount > 0) TextSpan(text: ' $currency', style: TextStyle(fontSize: 13, color: colors.inkMuted)),
                ]),
              ),
              if (r.bookingStatus == 'PAID' && r.bookingPaidAt != null)
                Text('✓ ${l10n.rvPaidOn(DateFormatter.mediumDate(r.bookingPaidAt!, languageCode: lang))}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: catalogAvailable)),
            ]),
          ),
          if (r.bookingAmount > 0)
            CatalogBadge.status(bookingPayLabel(l10n, r), r.bookingSettled ? catalogAvailable : catalogReserved),
        ]),
        if (extra != null) ...[const SizedBox(height: 12), extra!],
        const SizedBox(height: 14),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final (i, (label, at, done)) in steps.indexed)
            Expanded(
              child: Column(children: [
                Container(
                  key: Key('reservation-step-$i'),
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i == 3 && closedStep != null
                        ? const Color(0xFF9A9083)
                        : done
                            ? catalogAvailable
                            : i == now
                                ? AppPalette.gold400
                                : const Color(0xFFEFE8DC),
                    boxShadow: i == now ? const [BoxShadow(color: Color(0xFFF6E9C9), spreadRadius: 4)] : null,
                  ),
                  child: Icon(
                    i == 3 && closedStep != null ? Icons.close_rounded : (done ? Icons.check_rounded : Icons.more_horiz_rounded),
                    size: 15,
                    color: done || i == 3 && closedStep != null ? Colors.white : (i == now ? AppPalette.navy : const Color(0xFF9A9083)),
                  ),
                ),
                const SizedBox(height: 4),
                Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.inkStrong)),
                Text(i == now ? l10n.rvNextStep : day(at), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              ]),
            ),
        ]),
        if (closedStep != null && (r.reason ?? '').isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(l10n.rvReasonLine(r.reason!), style: TextStyle(fontSize: 12, color: colors.inkMuted)),
        ],
      ]),
    );
  }
}

class ReservationLinkCard extends StatelessWidget {
  const ReservationLinkCard({super.key, required this.icon, required this.title, required this.onTap, this.subtitle});
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: colors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: colors.hairline)),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Icon(icon, color: AppPalette.gold500),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: colors.inkStrong)),
                if (subtitle != null) Text(subtitle!, style: TextStyle(fontSize: 12, color: colors.inkMuted)),
              ]),
            ),
            // chevron_right mirrors to ‹ in Arabic: "more", outward.
            Icon(Icons.chevron_right_rounded, color: colors.inkMuted),
          ]),
        ),
      ),
    );
  }
}

class ReservationPlan extends StatelessWidget {
  const ReservationPlan({super.key, required this.page});
  final ReservationPage page;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final currency = PriceFormatter.symbol(Localizations.localeOf(context).languageCode);
    final r = page.row;
    String money(double? v) => v == null ? '—' : '${contractMoney(v)} $currency';
    return KvTable(rows: [
      (l10n.rvPlanName, page.planName == null ? '—' : ltrRuns(page.planName!).replaceAll('-', '\u2060-\u2060')),
      (l10n.cvTerm, r.months == null ? '—' : l10n.cvMonthsN(r.months!)),
      (l10n.cvDown, money(page.down)),
      (l10n.cvMonthly, money(r.monthly)),
      (l10n.cvTotal, money(page.total)),
      (l10n.rvUnitPrice, money(page.unitPrice)),
    ]);
  }
}

class ReservationHistory extends StatelessWidget {
  const ReservationHistory({super.key, required this.events});
  final List<ReservationEvent> events;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: homeCard(context, radius: 22),
      child: Column(children: [
        for (final (i, e) in events.indexed) ...[
          if (i > 0) Divider(height: 1, color: colors.hairline),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 9),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(e.isNote ? Icons.sticky_note_2_rounded : Icons.circle, size: e.isNote ? 16 : 8, color: e.isNote ? AppPalette.gold500 : colors.inkMuted),
              const SizedBox(width: 8),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(e.isNote ? (e.note ?? '') : reservationEventLabel(l10n, e.type),
                      style: TextStyle(fontSize: 12.5, fontWeight: e.isNote ? FontWeight.w500 : FontWeight.w700, color: colors.inkStrong)),
                  Text(
                    [
                      if ((e.by ?? '').isNotEmpty) RegExp('[A-Za-z]').hasMatch(e.by!) ? ltr(e.by!) : e.by!,
                      if (e.at != null) DateFormatter.mediumDate(e.at!, languageCode: lang),
                    ].join(' · '),
                    style: TextStyle(fontSize: 12, color: colors.inkMuted),
                  ),
                ]),
              ),
            ]),
          ),
        ],
      ]),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.primary, required this.secondary, this.busy = false, this.primaryColor});
  final (String, IconData, VoidCallback, Key) primary;
  final (String, IconData, VoidCallback, Key) secondary;
  final bool busy;
  final Color? primaryColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(color: colors.canvas, border: Border(top: BorderSide(color: colors.hairline))),
      child: Row(children: [
        Expanded(
          flex: 2,
          child: OutlinedButton.icon(
            key: secondary.$4,
            onPressed: busy ? null : secondary.$3,
            icon: Icon(secondary.$2, size: 18),
            label: Text(secondary.$1, maxLines: 1, softWrap: false, overflow: TextOverflow.ellipsis),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              padding: const EdgeInsets.symmetric(horizontal: 10),
              foregroundColor: colors.error,
              side: BorderSide(color: colors.error.withValues(alpha: 0.45), width: 1.4),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          flex: 3,
          child: FilledButton.icon(
            key: primary.$4,
            onPressed: busy ? null : primary.$3,
            icon: busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : Icon(primary.$2, size: 19),
            label: Text(primary.$1),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              backgroundColor: primaryColor ?? AppPalette.gold400,
              foregroundColor: primaryColor == null ? AppPalette.navy : Colors.white,
              textStyle: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
            ),
          ),
        ),
      ]),
    );
  }
}

/// When and how the booking amount was paid.
class _PaymentSheet extends StatefulWidget {
  const _PaymentSheet();

  @override
  State<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<_PaymentSheet> {
  DateTime _paidAt = DateTime.now();
  String _method = PaymentMethod.cash.wire;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, 16 + MediaQuery.paddingOf(context).bottom),
      decoration: const BoxDecoration(color: Color(0xFFFBF7F0), borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Center(
          child: Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(color: const Color(0xFFD9D0C2), borderRadius: BorderRadius.circular(9)),
          ),
        ),
        Text(l10n.rvRecordPayment, style: homeDisplay(19, colors.inkStrong)),
        const SizedBox(height: 14),
        Text(l10n.rvPayDate, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.inkMuted)),
        const SizedBox(height: 6),
        Material(
          color: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13), side: BorderSide(color: colors.hairline)),
          child: ListTile(
            key: const Key('reservation-pay-date'),
            title: Text(DateFormatter.mediumDate(_paidAt, languageCode: lang)),
            trailing: const Icon(Icons.calendar_today_rounded, size: 19),
            onTap: () async {
              final d = await showDatePicker(context: context, initialDate: _paidAt, firstDate: DateTime(2020), lastDate: DateTime.now());
              if (d != null) setState(() => _paidAt = d);
            },
          ),
        ),
        const SizedBox(height: 14),
        Text(l10n.rvPayMethod, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.inkMuted)),
        const SizedBox(height: 6),
        FilterSegments<String>(
          keyPrefix: 'reservation-pay-method',
          selected: _method,
          onSelect: (v) => setState(() => _method = v),
          options: [
            for (final m in [PaymentMethod.cash, PaymentMethod.bankTransfer, PaymentMethod.other]) FilterOption(m.wire, paymentMethodLabel(l10n, m) ?? m.wire),
          ],
        ),
        const SizedBox(height: 18),
        FilledButton(
          key: const Key('reservation-pay-confirm'),
          onPressed: () => Navigator.of(context).pop((_paidAt, _method)),
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(50),
            backgroundColor: AppPalette.gold400,
            foregroundColor: AppPalette.navy,
            textStyle: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
          ),
          child: Text(l10n.rvConfirm),
        ),
      ]),
    );
  }
}
