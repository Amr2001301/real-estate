import 'package:core/core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/visits/data/dtos/visit_request_dto.dart';
import 'package:mobile_customer/features/visits/data/mappers/visit_request_mapper.dart';
import 'package:mobile_customer/features/visits/domain/entities/visit_request.dart';
import 'package:mobile_customer/features/visits/domain/repositories/visits_repository.dart';
import 'package:mobile_customer/features/visits/domain/usecases/create_visit_request.dart';
import 'package:mobile_customer/features/visits/domain/usecases/get_my_visit_requests.dart';
import 'package:mobile_customer/features/visits/presentation/my_visits_cubit.dart';
import 'package:mobile_customer/features/visits/presentation/visit_request_cubit.dart';

class _FakeVisitsRepository implements VisitsRepository {
  _FakeVisitsRepository({this.createFailure, this.list = const []});
  final AppFailure? createFailure;
  final List<VisitRequest> list;

  @override
  Future<Result<void>> createVisitRequest(CreateVisitParams params) async =>
      createFailure != null ? Result.err(createFailure!) : const Ok(null);

  @override
  Future<Result<Paginated<VisitRequest>>> getMyVisitRequests({
    int page = 1,
    int pageSize = 20,
  }) async =>
      Result.ok(Paginated(
        data: list,
        meta: PageMeta(page: 1, pageSize: pageSize, total: list.length, totalPages: 1),
      ));
}

void main() {
  group('VisitRequestDto → entity mapper', () {
    test('maps wire status + dates + project name', () {
      final entity = VisitRequestDto.fromJson({
        'id': 'v1',
        'projectId': 'p1',
        'status': 'SCHEDULED',
        'preferredDate': '2026-06-01T00:00:00.000Z',
        'project': {'name': {'ar': 'أبراج', 'en': 'Towers'}},
      }).toEntity();
      expect(entity.status, VisitStatus.scheduled);
      expect(entity.projectName?.resolve('en'), 'Towers');
      expect(entity.preferredDate, isNotNull);
    });

    test('unknown status falls back', () {
      final e = VisitRequestDto.fromJson({'id': 'v', 'projectId': 'p', 'status': 'X'})
          .toEntity();
      expect(e.status, VisitStatus.unknown);
    });
  });

  group('VisitRequestCubit', () {
    final params = CreateVisitParams(projectId: 'p1', preferredDate: DateTime(2026, 6, 1));

    test('submit success emits success', () async {
      final cubit = VisitRequestCubit(CreateVisitRequest(_FakeVisitsRepository()));
      await cubit.submit(params);
      expect(cubit.state.status, VisitFormStatus.success);
    });

    test('submit failure surfaces an AppFailure', () async {
      final repo = _FakeVisitsRepository(createFailure: AppFailure(type: FailureType.server));
      final cubit = VisitRequestCubit(CreateVisitRequest(repo));
      await cubit.submit(params);
      expect(cubit.state.status, VisitFormStatus.failure);
      expect(cubit.state.failure?.type, FailureType.server);
    });
  });

  group('MyVisitsCubit', () {
    test('empty when no requests', () async {
      final cubit = MyVisitsCubit(GetMyVisitRequests(_FakeVisitsRepository()));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('success with requests', () async {
      final repo = _FakeVisitsRepository(list: const [
        VisitRequest(id: 'v1', projectId: 'p1', status: VisitStatus.pending, preferredDate: null),
      ]);
      final cubit = MyVisitsCubit(GetMyVisitRequests(repo));
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.data, hasLength(1));
    });
  });
}
