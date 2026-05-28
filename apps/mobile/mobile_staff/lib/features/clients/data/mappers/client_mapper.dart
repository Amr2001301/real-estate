import '../../domain/entities/staff_client.dart';
import '../dtos/client_lead_dto.dart';

DateTime? _date(String? raw) => DateTime.tryParse(raw ?? '');

/// Most recent row first (nulls last).
int _byNewest(ClientLeadDto a, ClientLeadDto b) {
  final at = _date(a.createdAt), bt = _date(b.createdAt);
  if (at == null && bt == null) return 0;
  if (at == null) return 1;
  if (bt == null) return -1;
  return bt.compareTo(at);
}

/// Collapse lead rows into distinct clients (grouped by clientId), keeping the
/// newest lead's stage as the client's latest stage.
List<StaffClient> clientsFromLeadRows(List<ClientLeadDto> rows) {
  final groups = <String, List<ClientLeadDto>>{};
  for (final r in rows) {
    groups.putIfAbsent(r.clientId, () => []).add(r);
  }
  final clients = <StaffClient>[];
  for (final entry in groups.entries) {
    final group = [...entry.value]..sort(_byNewest);
    final newest = group.first;
    clients.add(StaffClient(
      clientId: entry.key,
      fullName: newest.fullName,
      phone: newest.phone,
      email: newest.email,
      leadCount: group.length,
      latestStage: newest.stage,
    ));
  }
  clients.sort((a, b) => a.fullName.compareTo(b.fullName));
  return clients;
}

/// Build a client + its lead references from the rows for one clientId.
ClientDetail clientDetailFromRows(String clientId, List<ClientLeadDto> rows) {
  final sorted = [...rows]..sort(_byNewest);
  final newest = sorted.isNotEmpty ? sorted.first : null;
  final client = StaffClient(
    clientId: clientId,
    fullName: newest?.fullName ?? '',
    phone: newest?.phone,
    email: newest?.email,
    leadCount: sorted.length,
    latestStage: newest?.stage ?? 'NEW',
  );
  final leads = [
    for (final r in sorted)
      ClientLeadRef(
        leadId: r.leadId,
        stage: r.stage,
        projectInterest: r.projectInterest,
        createdAt: _date(r.createdAt),
      ),
  ];
  return ClientDetail(client: client, leads: leads);
}
