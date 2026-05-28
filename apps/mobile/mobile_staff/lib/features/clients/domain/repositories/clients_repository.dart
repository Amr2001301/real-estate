import 'package:core/core_domain.dart';

import '../entities/staff_client.dart';

abstract interface class ClientsRepository {
  Future<Result<List<StaffClient>>> getMyClients({String? search});
  Future<Result<ClientDetail>> getClient(String clientId);
}
