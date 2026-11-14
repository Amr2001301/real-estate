import 'package:core/core.dart';
import 'package:dio/dio.dart';

import '../domain/repositories/leads_repository.dart' show OpenLeadRef;

/// DUP2 — the open leads named by a 409 OPEN_LEAD_EXISTS refusal (empty for
/// any other failure).
List<OpenLeadRef> openLeadsOf(AppFailure failure) {
  if (failure.code != 'OPEN_LEAD_EXISTS') return const [];
  final err = failure.originalError;
  final data = err is DioException ? err.response?.data : null;
  final leads = data is Map ? data['leads'] : null;
  if (leads is! List) return const [];
  return [
    for (final l in leads.whereType<Map>())
      OpenLeadRef(
        id: l['id'] as String? ?? '',
        stage: l['stage'] as String? ?? 'NEW',
        ownerName: (l['assignedSales'] as Map?)?['fullName'] as String?,
        createdAt: DateTime.tryParse(l['createdAt'] as String? ?? '')?.toLocal(),
      ),
  ];
}
