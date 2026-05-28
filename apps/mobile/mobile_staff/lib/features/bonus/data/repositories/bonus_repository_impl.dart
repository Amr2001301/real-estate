import 'package:core/core.dart';

import '../../domain/entities/bonus_entry.dart';
import '../../domain/repositories/bonus_repository.dart';
import '../datasources/bonus_remote_data_source.dart';
import '../mappers/bonus_entry_mapper.dart';

class BonusRepositoryImpl implements BonusRepository {
  BonusRepositoryImpl(this._remote);
  final BonusRemoteDataSource _remote;

  @override
  Future<Result<List<BonusEntry>>> getEntries(BonusQuery query) {
    return guardApiCall(() async {
      final rows = await _remote.listEntries(query);
      return rows.map((r) => r.toEntity()).toList();
    });
  }
}
