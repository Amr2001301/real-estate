import 'package:core/core.dart';

/// «ليا وعليا» — what the company is owed and what it owes. Same API as the
/// dashboard's «المستحقات والالتزامات» page (GET /reports/ledger, /rows), so
/// the two always show the same numbers.

/// Where a row stands: by its due day, on its way, or waiting for approval.
enum LedgerState {
  late('late'),
  dueToday('dueToday'),
  upcoming('upcoming'),
  onItsWay('onItsWay'),
  pendingApproval('pendingApproval');

  const LedgerState(this.wire);
  final String wire;

  static LedgerState? fromWire(String? w) {
    for (final s in values) {
      if (s.wire == w) return s;
    }
    return null;
  }
}

/// The groups, in the dashboard's order. [onHold] is outside the payables total.
enum LedgerGroup {
  installments('installments', true),
  bookings('bookings', true),
  fees('fees', true),
  clawbacks('clawbacks', true),
  commissions('commissions', false),
  bonuses('bonuses', false),
  topUps('topUps', false),
  refunds('refunds', false),
  onHold('onHold', false);

  const LedgerGroup(this.wire, this.receivable);
  final String wire;
  final bool receivable;

  static LedgerGroup? fromWire(String? w) {
    for (final g in values) {
      if (g.wire == w) return g;
    }
    return null;
  }
}

class LedgerFigure extends Equatable {
  const LedgerFigure({required this.amount, required this.count, this.states = const {}});
  final double amount;
  final int count;
  final Map<LedgerState, LedgerFigure> states;

  static LedgerFigure fromJson(Object? json) {
    final m = (json as Map?)?.cast<String, dynamic>() ?? const {};
    final st = (m['states'] as Map?)?.cast<String, dynamic>() ?? const {};
    return LedgerFigure(
      amount: readAmount(m['amount']) ?? 0,
      count: (m['count'] as num?)?.toInt() ?? 0,
      states: {
        for (final e in st.entries)
          if (LedgerState.fromWire(e.key) != null) LedgerState.fromWire(e.key)!: LedgerFigure.fromJson(e.value),
      },
    );
  }

  @override
  List<Object?> get props => [amount, count, states];
}

class LedgerSummary extends Equatable {
  const LedgerSummary({
    required this.asOf,
    required this.receivables,
    required this.payables,
    required this.net,
    required this.groups,
  });

  final DateTime asOf;
  final double receivables;
  final double payables;
  final double net;
  final Map<LedgerGroup, LedgerFigure> groups;

  factory LedgerSummary.fromJson(Map<String, dynamic> json) {
    final rec = (json['receivables'] as Map?)?.cast<String, dynamic>() ?? const {};
    final pay = (json['payables'] as Map?)?.cast<String, dynamic>() ?? const {};
    final groups = <LedgerGroup, LedgerFigure>{};
    for (final side in [rec, pay]) {
      final g = (side['groups'] as Map?)?.cast<String, dynamic>() ?? const {};
      for (final e in g.entries) {
        final key = LedgerGroup.fromWire(e.key);
        if (key != null) groups[key] = LedgerFigure.fromJson(e.value);
      }
    }
    if (pay['onHold'] != null) groups[LedgerGroup.onHold] = LedgerFigure.fromJson(pay['onHold']);
    return LedgerSummary(
      asOf: DateTime.tryParse((json['asOf'] as String?) ?? '') ?? DateTime.now(),
      receivables: readAmount(rec['total']) ?? 0,
      payables: readAmount(pay['total']) ?? 0,
      net: readAmount(json['net']) ?? 0,
      groups: groups,
    );
  }

  @override
  List<Object?> get props => [asOf, receivables, payables, net, groups];
}

class LedgerRow extends Equatable {
  const LedgerRow({
    required this.id,
    required this.type,
    this.date,
    required this.amount,
    this.state,
    this.partyName,
    this.contractNumber,
    this.unitCode,
    this.reservationNumber,
  });

  final String id;

  /// Schedule row type, or COMMISSION / BONUS / TOP_UP / REFUND / BOOKING / *_CLAWBACK.
  final String type;
  final DateTime? date;
  final double amount;
  final LedgerState? state;
  final String? partyName;
  final String? contractNumber;
  final String? unitCode;
  final String? reservationNumber;

  factory LedgerRow.fromJson(Map<String, dynamic> j) {
    Map<String, dynamic>? m(Object? v) => (v as Map?)?.cast<String, dynamic>();
    return LedgerRow(
      id: (j['id'] as String?) ?? '',
      type: (j['type'] as String?) ?? '',
      date: DateTime.tryParse((j['date'] as String?) ?? ''),
      amount: readAmount(j['amount']) ?? 0,
      state: LedgerState.fromWire(j['state'] as String?),
      partyName: m(j['party'])?['name'] as String?,
      contractNumber: m(j['contract'])?['number'] as String?,
      unitCode: m(j['unit'])?['code'] as String?,
      reservationNumber: m(j['reservation'])?['number'] as String?,
    );
  }

  @override
  List<Object?> get props => [id, type, date, amount, state, partyName, contractNumber, unitCode, reservationNumber];
}

/// The dashboard's periods; the dates come from the company's "today" ([LedgerSummary.asOf]).
enum LedgerPeriod { all, thisMonth, nextMonth, quarter, year }

({String? dateFrom, String? dateTo}) ledgerPeriodRange(LedgerPeriod p, DateTime today) {
  String d(int y, int m, int day) => '${y.toString().padLeft(4, '0')}-${m.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
  int last(int y, int m) => DateTime.utc(y, m + 1, 0).day;
  final y = today.year, m = today.month;
  switch (p) {
    case LedgerPeriod.all:
      return (dateFrom: null, dateTo: null);
    case LedgerPeriod.thisMonth:
      return (dateFrom: d(y, m, 1), dateTo: d(y, m, last(y, m)));
    case LedgerPeriod.nextMonth:
      final ny = m == 12 ? y + 1 : y, nm = m == 12 ? 1 : m + 1;
      return (dateFrom: d(ny, nm, 1), dateTo: d(ny, nm, last(ny, nm)));
    case LedgerPeriod.quarter:
      final q0 = ((m - 1) ~/ 3) * 3 + 1;
      return (dateFrom: d(y, q0, 1), dateTo: d(y, q0 + 2, last(y, q0 + 2)));
    case LedgerPeriod.year:
      return (dateFrom: d(y, 1, 1), dateTo: d(y, 12, 31));
  }
}

abstract interface class LedgerRepository {
  Future<Result<LedgerSummary>> summary({String? dateFrom, String? dateTo});
  Future<Result<Paginated<LedgerRow>>> rows(
    LedgerGroup group, {
    LedgerState? state,
    String? dateFrom,
    String? dateTo,
    int page = 1,
  });
}
