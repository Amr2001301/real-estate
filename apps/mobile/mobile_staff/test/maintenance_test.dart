import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/maintenance/data/dtos/maintenance_dtos.dart';
import 'package:mobile_staff/features/maintenance/data/mappers/maintenance_mapper.dart';
import 'package:mobile_staff/features/maintenance/data/repositories/maintenance_repository_impl.dart';
import 'package:mobile_staff/features/maintenance/data/datasources/maintenance_remote_data_source.dart';
import 'package:mobile_staff/features/maintenance/domain/entities/maintenance_request.dart';
import 'package:mobile_staff/features/maintenance/domain/repositories/maintenance_repository.dart';
import 'package:mobile_staff/features/maintenance/domain/usecases/maintenance_use_cases.dart';
import 'package:mobile_staff/features/maintenance/presentation/cubit/maintenance_detail_cubit.dart';
import 'package:mobile_staff/features/maintenance/presentation/cubit/maintenance_list_cubit.dart';

class _FakeRemote implements MaintenanceRemoteDataSource {
  _FakeRemote({this.rows = const [], this.error});
  final List<MaintenanceRequestDto> rows;
  final DioException? error;

  @override
  Future<List<MaintenanceRequestDto>> listAssigned() async {
    if (error != null) throw error!;
    return rows;
  }

  @override
  Future<MaintenanceDetailDto> getOne(String id) async => throw UnimplementedError();
  @override
  Future<void> setStatus(String id, MaintenanceTransition transition) async {}
  @override
  Future<void> confirmResolution(String id) async {}
}

class _FakeRepo implements MaintenanceRepository {
  _FakeRepo({
    Result<List<MaintenanceRequest>>? assigned,
    Result<MaintenanceDetail>? detail,
    this.statusResult = const Ok(null),
    this.confirmResult = const Ok(null),
  })  : assigned = assigned ?? const Ok([]),
        detail = detail ?? Ok(MaintenanceDetail(request: _req()));

  final Result<List<MaintenanceRequest>> assigned;
  Result<MaintenanceDetail> detail;
  final Result<void> statusResult;
  final Result<void> confirmResult;

  int statusCalls = 0;
  int confirmCalls = 0;

  @override
  Future<Result<List<MaintenanceRequest>>> getAssigned() async => assigned;
  @override
  Future<Result<MaintenanceDetail>> getDetail(String id) async => detail;
  @override
  Future<Result<void>> updateStatus(String id, MaintenanceTransition t) async {
    statusCalls++;
    return statusResult;
  }

  @override
  Future<Result<void>> confirmResolution(String id) async {
    confirmCalls++;
    return confirmResult;
  }
}

MaintenanceRequest _req({
  MaintenanceStatus status = MaintenanceStatus.assigned,
  DateTime? supervisorConfirmedAt,
}) =>
    MaintenanceRequest(
      id: 'm1',
      description: 'Leak',
      status: status,
      priority: MaintenancePriority.high,
      supervisorConfirmedResolutionAt: supervisorConfirmedAt,
    );

Map<String, dynamic> _json({String status = 'ASSIGNED'}) => {
      'id': 'm1',
      'description': 'Leak',
      'status': status,
      'priority': 'HIGH',
      'reviewStatus': 'APPROVED',
      'customer': {'fullName': 'Mona', 'phone': '+201', 'email': 'm@x.com'},
      'unit': {'code': 'A-1'},
      'category': {
        'name': {'ar': 'سباكة', 'en': 'Plumbing'},
      },
      'createdAt': '2026-04-01T00:00:00.000Z',
      'dueAt': '2026-04-02T00:00:00.000Z',
      'complaintAt': '2026-04-04T00:00:00.000Z',
      'unresolvedAt': '2026-04-05T00:00:00.000Z',
      'customerConfirmedResolutionAt': '2026-04-06T00:00:00.000Z',
      'resolvedBy': 'BOTH',
      'customerRating': 5,
      'customerRatingText': 'ممتاز',
    };

void main() {
  group('MaintenanceRequestDto → entity', () {
    test('maps base + Phase A fields', () {
      final r = MaintenanceRequestDto.fromJson(_json()).toEntity();
      expect(r.status, MaintenanceStatus.assigned);
      expect(r.priority, MaintenancePriority.high);
      expect(r.customerName, 'Mona');
      expect(r.unitCode, 'A-1');
      expect(r.categoryName?.en, 'Plumbing');
      expect(r.dueAt, isNotNull);
      expect(r.complaintAt, isNotNull);
      expect(r.unresolvedAt, isNotNull);
      expect(r.resolvedBy, MaintenanceResolvedBy.both);
      expect(r.customerRating, 5);
      expect(r.customerRatingText, 'ممتاز');
    });

    test('tolerates flat-string category name (backend sends plain string not locale map)', () {
      final json = {
        ..._json(),
        'category': {'name': 'Plumbing'},
      };
      // Must not throw — _asMap('Plumbing') returns null, so categoryName → null
      final r = MaintenanceRequestDto.fromJson(json).toEntity();
      expect(r.categoryName, isNull);
    });

    test('tolerates missing category', () {
      final m = Map<String, dynamic>.from(_json())..remove('category');
      final r = MaintenanceRequestDto.fromJson(m).toEntity();
      expect(r.categoryName, isNull);
    });

    test('tolerates null customer and unit', () {
      final json = {
        ..._json(),
        'customer': null,
        'unit': null,
      };
      final r = MaintenanceRequestDto.fromJson(json).toEntity();
      expect(r.customerName, isNull);
      expect(r.unitCode, isNull);
    });

    test('detail dto parses documents array', () {
      final detail = MaintenanceDetailDto.fromJson({
        ..._json(),
        'documents': [
          {'id': 'd1', 'title': 'صورة قبل', 'fileName': 'before.jpg'},
        ],
      }).toEntity();
      expect(detail.documents, hasLength(1));
      expect(detail.documents.first.title, 'صورة قبل');
    });
  });

  group('MaintenanceDoc.isImage detection', () {
    test('mimeType image/* → true', () {
      expect(const MaintenanceDoc(id: 'd1', mimeType: 'image/jpeg').isImage, isTrue);
      expect(const MaintenanceDoc(id: 'd2', mimeType: 'image/png').isImage, isTrue);
      expect(const MaintenanceDoc(id: 'd3', mimeType: 'image/webp').isImage, isTrue);
    });

    test('non-image mimeType → false', () {
      expect(const MaintenanceDoc(id: 'd4', mimeType: 'application/pdf').isImage, isFalse);
      expect(const MaintenanceDoc(id: 'd5', mimeType: 'text/plain').isImage, isFalse);
    });

    test('image extension (lower-case) → true', () {
      expect(const MaintenanceDoc(id: 'd6', fileName: 'photo.jpg').isImage, isTrue);
      expect(const MaintenanceDoc(id: 'd7', fileName: 'photo.jpeg').isImage, isTrue);
      expect(const MaintenanceDoc(id: 'd8', fileName: 'photo.png').isImage, isTrue);
      expect(const MaintenanceDoc(id: 'd9', fileName: 'photo.webp').isImage, isTrue);
    });

    test('image extension (upper-case) → true', () {
      expect(const MaintenanceDoc(id: 'd10', fileName: 'PHOTO.JPG').isImage, isTrue);
      expect(const MaintenanceDoc(id: 'd11', fileName: 'PHOTO.PNG').isImage, isTrue);
    });

    test('non-image extension → false', () {
      expect(const MaintenanceDoc(id: 'd12', fileName: 'report.pdf').isImage, isFalse);
      expect(const MaintenanceDoc(id: 'd13', fileName: 'data.xlsx').isImage, isFalse);
    });

    test('no mimeType and no fileName → false', () {
      expect(const MaintenanceDoc(id: 'd14').isImage, isFalse);
    });
  });

  group('unit location parsing', () {
    test('reads lat/lng from unit.lat and unit.lng', () {
      final json = {..._json(), 'unit': {'code': 'U1', 'lat': 30.1, 'lng': 31.2}};
      final r = MaintenanceRequestDto.fromJson(json).toEntity();
      expect(r.unitLat, closeTo(30.1, 0.0001));
      expect(r.unitLng, closeTo(31.2, 0.0001));
    });

    test('reads lat/lng from unit.latitude and unit.longitude', () {
      final json = {..._json(), 'unit': {'code': 'U1', 'latitude': 30.1, 'longitude': 31.2}};
      final r = MaintenanceRequestDto.fromJson(json).toEntity();
      expect(r.unitLat, closeTo(30.1, 0.0001));
      expect(r.unitLng, closeTo(31.2, 0.0001));
    });

    test('reads lat/lng from nested unit.location object', () {
      final json = {
        ..._json(),
        'unit': {'code': 'U1', 'location': {'lat': 30.1, 'lng': 31.2}},
      };
      final r = MaintenanceRequestDto.fromJson(json).toEntity();
      expect(r.unitLat, closeTo(30.1, 0.0001));
      expect(r.unitLng, closeTo(31.2, 0.0001));
    });

    test('reads address from unit.address', () {
      final json = {..._json(), 'unit': {'code': 'U1', 'address': 'شارع النيل'}};
      final r = MaintenanceRequestDto.fromJson(json).toEntity();
      expect(r.unitAddress, 'شارع النيل');
    });

    test('reads address from unit.fullAddress fallback', () {
      final json = {..._json(), 'unit': {'code': 'U1', 'fullAddress': 'Cairo, Egypt'}};
      final r = MaintenanceRequestDto.fromJson(json).toEntity();
      expect(r.unitAddress, 'Cairo, Egypt');
    });

    test('returns null for all location fields when unit has only code (current backend state)', () {
      final r = MaintenanceRequestDto.fromJson(_json()).toEntity();
      expect(r.unitLat, isNull);
      expect(r.unitLng, isNull);
      expect(r.unitAddress, isNull);
    });
  });

  group('doc URL field parsing', () {
    test('reads from url field', () {
      final detail = MaintenanceDetailDto.fromJson({
        ..._json(),
        'documents': [
          {'id': 'd1', 'title': 'img', 'fileName': 'a.jpg', 'url': 'https://cdn/a.jpg'},
        ],
      }).toEntity();
      expect(detail.documents.first.url, 'https://cdn/a.jpg');
    });

    test('reads from signedUrl field', () {
      final detail = MaintenanceDetailDto.fromJson({
        ..._json(),
        'documents': [
          {'id': 'd1', 'fileName': 'b.jpg', 'signedUrl': 'https://s3/b.jpg?sig=x'},
        ],
      }).toEntity();
      expect(detail.documents.first.url, 'https://s3/b.jpg?sig=x');
    });

    test('reads from downloadUrl field', () {
      final detail = MaintenanceDetailDto.fromJson({
        ..._json(),
        'documents': [
          {'id': 'd1', 'fileName': 'c.jpg', 'downloadUrl': 'https://api/c.jpg'},
        ],
      }).toEntity();
      expect(detail.documents.first.url, 'https://api/c.jpg');
    });

    test('url is null when backend returns no URL field (current state)', () {
      final detail = MaintenanceDetailDto.fromJson({
        ..._json(),
        'documents': [
          {'id': 'd1', 'title': 'before', 'fileName': 'before.jpg'},
        ],
      }).toEntity();
      expect(detail.documents.first.url, isNull);
    });
  });

  group('Google Maps URL building', () {
    test('lat/lng URL has correct destination query param', () {
      const lat = 30.1234;
      const lng = 31.5678;
      final url = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving',
      );
      expect(url.queryParameters['destination'], '$lat,$lng');
      expect(url.queryParameters['travelmode'], 'driving');
    });

    test('address URL decodes back to original address', () {
      const address = 'شارع التحرير، القاهرة';
      final encoded = Uri.encodeComponent(address);
      final url = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=$encoded&travelmode=driving',
      );
      expect(url.queryParameters['destination'], address);
    });
  });

  group('entity transitions + getters', () {
    test('allowedTransitions follow the supervisor subset', () {
      expect(_req(status: MaintenanceStatus.assigned).allowedTransitions, [MaintenanceTransition.start]);
      expect(_req(status: MaintenanceStatus.inProgress).allowedTransitions, [MaintenanceTransition.resolve]);
      expect(_req(status: MaintenanceStatus.resolved).allowedTransitions, [MaintenanceTransition.reopen]);
      expect(_req(status: MaintenanceStatus.closed).allowedTransitions, isEmpty);
    });

    test('canSupervisorConfirm true on RESOLVED unconfirmed, false once confirmed', () {
      expect(_req(status: MaintenanceStatus.resolved).canSupervisorConfirm, isTrue);
      expect(
        _req(status: MaintenanceStatus.resolved, supervisorConfirmedAt: DateTime(2026, 4, 6))
            .canSupervisorConfirm,
        isFalse,
      );
      expect(_req(status: MaintenanceStatus.inProgress).canSupervisorConfirm, isFalse);
    });
  });

  group('MaintenanceRepositoryImpl error mapping', () {
    test('403 → Err(forbidden)', () async {
      final repo = MaintenanceRepositoryImpl(_FakeRemote(
        error: DioException(
          requestOptions: RequestOptions(path: '/me/maintenance-requests'),
          type: DioExceptionType.badResponse,
          response: Response(
            requestOptions: RequestOptions(path: '/me/maintenance-requests'),
            statusCode: 403,
          ),
        ),
      ));
      final result = await repo.getAssigned();
      expect(result.failureOrNull?.type, FailureType.forbidden);
    });

    test('success maps rows', () async {
      final repo = MaintenanceRepositoryImpl(
        _FakeRemote(rows: [MaintenanceRequestDto.fromJson(_json())]),
      );
      final result = await repo.getAssigned();
      expect(result.dataOrNull, hasLength(1));
    });
  });

  group('MaintenanceListCubit', () {
    test('empty → empty state', () async {
      final cubit = MaintenanceListCubit(GetAssignedMaintenance(_FakeRepo(assigned: const Ok([]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('success → data state', () async {
      final cubit = MaintenanceListCubit(
        GetAssignedMaintenance(_FakeRepo(assigned: Ok([_req()]))),
      );
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.requests, hasLength(1));
    });

    test('failure → failure state', () async {
      final cubit = MaintenanceListCubit(GetAssignedMaintenance(
        _FakeRepo(assigned: Result.err(AppFailure(type: FailureType.network))),
      ));
      await cubit.load();
      expect(cubit.state.status, DataStatus.failure);
    });
  });

  group('MaintenanceDetailCubit', () {
    MaintenanceDetailCubit make(_FakeRepo repo) => MaintenanceDetailCubit(
          GetMaintenanceDetail(repo),
          UpdateMaintenanceStatus(repo),
          ConfirmMaintenanceResolution(repo),
          requestId: 'm1',
        );

    test('load → success with detail', () async {
      final repo = _FakeRepo(detail: Ok(MaintenanceDetail(request: _req())));
      final cubit = make(repo);
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.detail, isNotNull);
    });

    test('applyTransition success calls API + refreshes, clears working', () async {
      final repo = _FakeRepo(
        detail: Ok(MaintenanceDetail(request: _req(status: MaintenanceStatus.inProgress))),
      );
      final cubit = make(repo);
      await cubit.load();
      await cubit.applyTransition(MaintenanceTransition.start);
      expect(repo.statusCalls, 1);
      expect(cubit.state.working, isFalse);
      expect(cubit.state.actionFailure, isNull);
    });

    test('applyTransition failure surfaces actionFailure', () async {
      final repo = _FakeRepo(statusResult: Result.err(AppFailure(type: FailureType.validation)));
      final cubit = make(repo);
      await cubit.load();
      await cubit.applyTransition(MaintenanceTransition.resolve);
      expect(cubit.state.actionFailure?.type, FailureType.validation);
      expect(cubit.state.working, isFalse);
    });

    test('confirmResolution success calls API + refreshes', () async {
      final repo = _FakeRepo(
        detail: Ok(MaintenanceDetail(
          request: _req(status: MaintenanceStatus.resolved, supervisorConfirmedAt: DateTime(2026, 4, 7)),
        )),
      );
      final cubit = make(repo);
      await cubit.load();
      await cubit.confirmResolution();
      expect(repo.confirmCalls, 1);
      expect(cubit.state.detail?.request.supervisorHasConfirmed, isTrue);
      expect(cubit.state.working, isFalse);
    });

    test('confirmResolution failure surfaces actionFailure', () async {
      final repo = _FakeRepo(confirmResult: Result.err(AppFailure(type: FailureType.validation)));
      final cubit = make(repo);
      await cubit.load();
      await cubit.confirmResolution();
      expect(cubit.state.actionFailure?.type, FailureType.validation);
      expect(cubit.state.working, isFalse);
    });
  });
}
