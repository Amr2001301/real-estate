import 'package:core/core.dart';

import '../../domain/entities/staff_client.dart';
import '../../domain/repositories/clients_repository.dart';
import '../datasources/clients_remote_data_source.dart';
import '../mappers/client_mapper.dart';

class ClientsRepositoryImpl implements ClientsRepository {
  ClientsRepositoryImpl(this._remote);
  final ClientsRemoteDataSource _remote;

  @override
  Future<Result<List<StaffClient>>> getMyClients({String? search}) {
    return guardApiCall(() async {
      final rows = await _remote.listLeads(search: search);
      return clientsFromLeadRows(rows);
    });
  }

  @override
  Future<Result<ClientDetail>> getClient(String clientId) {
    return guardApiCall(() async {
      final rows = await _remote.listLeadsForClient(clientId);
      return clientDetailFromRows(clientId, rows);
    });
  }
}
