import 'package:core/core.dart';

import '../../domain/entities/contract_statement.dart';

/// Parses `GET /contracts/me/contracts/:id/statement`. Money comes as decimal
/// strings; dates as `YYYY-MM-DD`.
ContractStatement contractStatementFromJson(Map<String, dynamic> json) {
  final totals = (json['totals'] as Map?)?.cast<String, dynamic>() ?? const {};
  double amount(Object? v) => readAmount(v) ?? 0;
  DateTime? date(Object? v) => v is String && v.isNotEmpty ? DateTime.tryParse(v) : null;
  final lines = ((json['lines'] as List?) ?? const [])
      .whereType<Map>()
      .map((m) => m.cast<String, dynamic>())
      .map(
        (l) => StatementLine(
          date: date(l['date']) ?? DateTime(1970),
          kind: (l['kind'] as String?) ?? '',
          rowType: l['rowType'] as String?,
          rowDueDate: date(l['rowDueDate']),
          method: l['method'] as String?,
          unrecorded: l['unrecorded'] == true,
          debit: amount(l['debit']),
          credit: amount(l['credit']),
          balance: amount(l['balance']),
          reason: l['reason'] as String?,
        ),
      )
      .toList();
  return ContractStatement(
    asOf: date(json['asOf']) ?? DateTime.now(),
    lines: lines,
    contractValue: amount(totals['contractValue']),
    fees: amount(totals['fees']),
    paid: amount(totals['paid']),
    balance: amount(totals['balance']),
    overdue: amount(totals['overdue']),
    dueToday: amount(totals['dueToday']),
    upcoming: amount(totals['upcoming']),
    awaiting: amount(totals['awaiting']),
    awaitingCount: ((json['awaiting'] as List?) ?? const []).length,
  );
}
