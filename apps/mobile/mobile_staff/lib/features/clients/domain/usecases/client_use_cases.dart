import 'package:core/core_domain.dart';

import '../entities/staff_client.dart';
import '../repositories/clients_repository.dart';

class GetMyClients implements UseCase<List<StaffClient>, String?> {
  const GetMyClients(this._repo);
  final ClientsRepository _repo;

  @override
  Future<Result<List<StaffClient>>> call(String? search) =>
      _repo.getMyClients(search: search);
}

class GetClientDetail implements UseCase<ClientDetail, String> {
  const GetClientDetail(this._repo);
  final ClientsRepository _repo;

  @override
  Future<Result<ClientDetail>> call(String clientId) => _repo.getClient(clientId);
}
