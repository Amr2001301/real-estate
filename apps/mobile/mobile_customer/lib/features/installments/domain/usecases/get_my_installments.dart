import 'package:core/core_domain.dart';

import '../entities/installment.dart';
import '../repositories/installments_repository.dart';

class GetMyInstallments implements UseCase<List<Installment>, NoParams> {
  const GetMyInstallments(this._repo);
  final InstallmentsRepository _repo;

  @override
  Future<Result<List<Installment>>> call(NoParams params) =>
      _repo.getMyInstallments();
}
