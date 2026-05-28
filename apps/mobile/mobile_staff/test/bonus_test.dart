import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/bonus/data/dtos/bonus_entry_dto.dart';
import 'package:mobile_staff/features/bonus/data/mappers/bonus_entry_mapper.dart';
import 'package:mobile_staff/features/bonus/data/datasources/bonus_remote_data_source.dart';
import 'package:mobile_staff/features/bonus/data/repositories/bonus_repository_impl.dart';
import 'package:mobile_staff/features/bonus/domain/entities/bonus_entry.dart';
import 'package:mobile_staff/features/bonus/domain/repositories/bonus_repository.dart';
import 'package:mobile_staff/features/bonus/domain/usecases/get_bonus_entries.dart';
import 'package:mobile_staff/features/bonus/presentation/cubit/bonus_cubit.dart';
import 'package:mobile_staff/features/bonus/presentation/cubit/bonus_summary_cubit.dart';

class _FakeRemote implements BonusRemoteDataSource {
  _FakeRemote({this.rows = const [], this.error});
  final List<BonusEntryDto> rows;
  final DioException? error;

  @override
  Future<List<BonusEntryDto>> listEntries(BonusQuery query) async {
    if (error != null) throw error!;
    return rows;
  }
}

class _FakeRepo implements BonusRepository {
  _FakeRepo(this._result);
  final Result<List<BonusEntry>> _result;
  @override
  Future<Result<List<BonusEntry>>> getEntries(BonusQuery q) async => _result;
}

Map<String, dynamic> _row({String status = 'PENDING', String amount = '1000'}) => {
      'id': 'b1',
      'amount': amount,
      'period': '2026-05',
      'status': status,
      'rule': {'name': 'Q2 bonus'},
    };

BonusEntry _entry(String status, String amount) =>
    BonusEntry(id: 'b', amount: amount, period: '2026-05', status: status);

void main() {
  group('BonusEntryDto → entity', () {
    test('maps amount/status/rule', () {
      final e = BonusEntryDto.fromJson(_row(status: 'PAID', amount: '2500')).toEntity();
      expect(e.amount, '2500');
      expect(e.status, 'PAID');
      expect(e.ruleName, 'Q2 bonus');
    });
  });

  group('bonusOverviewOf', () {
    test('sums paid vs not-yet-paid (PENDING + APPROVED)', () {
      final o = bonusOverviewOf([
        _entry('PAID', '1000'),
        _entry('PENDING', '500'),
        _entry('APPROVED', '300'),
      ]);
      expect(o.paidTotal, 1000);
      expect(o.pendingTotal, 800);
      expect(o.count, 3);
    });
  });

  group('BonusRepositoryImpl error mapping', () {
    test('403 → forbidden', () async {
      final repo = BonusRepositoryImpl(_FakeRemote(
        error: DioException(
          requestOptions: RequestOptions(path: '/bonus-entries'),
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: 403),
        ),
      ));
      final r = await repo.getEntries(const BonusQuery());
      expect(r.failureOrNull?.type, FailureType.forbidden);
    });

    test('success maps rows', () async {
      final repo = BonusRepositoryImpl(_FakeRemote(rows: [BonusEntryDto.fromJson(_row())]));
      final r = await repo.getEntries(const BonusQuery());
      expect(r.dataOrNull, hasLength(1));
    });
  });

  group('BonusCubit', () {
    test('empty → empty', () async {
      final cubit = BonusCubit(GetBonusEntries(_FakeRepo(const Ok([]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('success computes overview', () async {
      final cubit = BonusCubit(GetBonusEntries(_FakeRepo(Ok([
        _entry('PAID', '1000'),
        _entry('PENDING', '250'),
      ]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.overview.paidTotal, 1000);
      expect(cubit.state.overview.pendingTotal, 250);
    });
  });

  group('BonusSummaryCubit (permission-aware)', () {
    test('forbidden → unavailable, never throws', () async {
      final cubit = BonusSummaryCubit(GetBonusEntries(
        _FakeRepo(Result.err(AppFailure(type: FailureType.forbidden))),
      ));
      await cubit.load();
      expect(cubit.state.status, SummaryStatus.unavailable);
    });

    test('success → ready with overview', () async {
      final cubit = BonusSummaryCubit(GetBonusEntries(_FakeRepo(Ok([_entry('PAID', '500')]))));
      await cubit.load();
      expect(cubit.state.status, SummaryStatus.ready);
      expect(cubit.state.overview?.paidTotal, 500);
    });
  });
}
