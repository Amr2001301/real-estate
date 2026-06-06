import 'dart:typed_data';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/maintenance/data/datasources/maintenance_remote_data_source.dart';
import 'package:mobile_customer/features/maintenance/data/dtos/maintenance_dtos.dart';
import 'package:mobile_customer/features/maintenance/data/dtos/maintenance_upload_dtos.dart';
import 'package:mobile_customer/features/maintenance/data/mappers/maintenance_mapper.dart';
import 'package:mobile_customer/features/maintenance/data/repositories/maintenance_repository_impl.dart';
import 'package:mobile_customer/features/maintenance/domain/entities/maintenance_category.dart';
import 'package:mobile_customer/features/maintenance/domain/entities/maintenance_request.dart';
import 'package:mobile_customer/features/maintenance/domain/repositories/maintenance_repository.dart';
import 'package:mobile_customer/features/maintenance/domain/usecases/maintenance_use_cases.dart';
import 'package:mobile_customer/features/maintenance/presentation/create_maintenance_cubit.dart';
import 'package:mobile_customer/features/maintenance/presentation/maintenance_detail_cubit.dart';
import 'package:mobile_customer/features/maintenance/presentation/maintenance_requests_cubit.dart';
import 'package:mobile_customer/features/maintenance/presentation/photo_picker.dart';
import 'package:mobile_customer/features/my_property/domain/entities/property.dart';
import 'package:mobile_customer/features/my_property/domain/repositories/my_property_repository.dart';
import 'package:mobile_customer/features/my_property/domain/usecases/get_my_properties.dart';

class _FakeMaintenanceRepo implements MaintenanceRepository {
  _FakeMaintenanceRepo({
    this.categories = const Ok([]),
    this.requests = const Ok([]),
    Result<MaintenanceRequest>? createResult,
    List<Result<void>>? uploadResults,
  }) : createResult =
           createResult ??
           Ok(
             const MaintenanceRequest(
               id: 'r1',
               description: 'x',
               status: MaintenanceStatus.open,
               priority: MaintenancePriority.medium,
             ),
           ),
       _uploadResults = uploadResults ?? const [];

  final Result<List<MaintenanceCategory>> categories;
  final Result<List<MaintenanceRequest>> requests;
  final Result<MaintenanceRequest> createResult;

  /// Consumed in order; falls back to Ok once exhausted.
  final List<Result<void>> _uploadResults;

  NewMaintenanceRequest? lastCreate;
  int createCalls = 0;
  int uploadCalls = 0;
  final List<MaintenancePhotoUpload> uploads = [];

  @override
  Future<Result<List<MaintenanceCategory>>> getCategories() async => categories;
  @override
  Future<Result<List<MaintenanceRequest>>> getMyRequests() async => requests;
  @override
  Future<Result<MaintenanceRequest>> createRequest(
    NewMaintenanceRequest input,
  ) async {
    createCalls++;
    lastCreate = input;
    return createResult;
  }

  @override
  Future<Result<void>> uploadPhoto(MaintenancePhotoUpload input) async {
    uploads.add(input);
    final result = uploadCalls < _uploadResults.length
        ? _uploadResults[uploadCalls]
        : const Ok(null);
    uploadCalls++;
    input.onProgress?.call(1);
    return result;
  }

  @override
  Future<Result<MaintenanceRequest>> confirmResolution({
    required String requestId,
    required int rating,
    String? note,
  }) async => createResult;

  @override
  Future<Result<MaintenanceRequest>> submitComplaint(String requestId) async =>
      createResult;
}

class _FakePhotoPicker implements PhotoPicker {
  _FakePhotoPicker({this.gallery = const [], this.camera, this.error});
  final List<PickedPhoto> gallery;
  final PickedPhoto? camera;
  final PhotoPickerException? error;

  @override
  Future<List<PickedPhoto>> pickFromGallery({int? limit}) async {
    if (error != null) throw error!;
    // Intentionally ignores `limit` — it's a platform hint, so the cubit must
    // still enforce the max-count cap itself.
    return gallery;
  }

  @override
  Future<PickedPhoto?> captureFromCamera() async {
    if (error != null) throw error!;
    return camera;
  }
}

PickedPhoto _photo({
  String mime = 'image/jpeg',
  int size = 1024,
  String name = 'a.jpg',
}) => PickedPhoto(
  bytes: Uint8List.fromList([1, 2, 3]),
  fileName: name,
  mimeType: mime,
  sizeBytes: size,
);

class _FakePropertyRepo implements MyPropertyRepository {
  _FakePropertyRepo(this._result);
  final Result<List<Property>> _result;
  @override
  Future<Result<List<Property>>> getMyProperties() async => _result;
}

Property _property(String unitId) => Property(
  contractId: 'c-$unitId',
  unitId: unitId,
  unitCode: unitId.toUpperCase(),
  unitType: 'APARTMENT',
  projectName: const Translatable(ar: '', en: 'P'),
  status: PropertyStatus.owned,
);

void main() {
  group('Maintenance mappers', () {
    test('category dto → entity', () {
      final c = MaintenanceCategoryDto.fromJson({
        'id': 'cat1',
        'name': {'ar': 'سباكة', 'en': 'Plumbing'},
      }).toEntity();
      expect(c.id, 'cat1');
      expect(c.name.en, 'Plumbing');
    });

    test('request dto → entity maps status/priority/category', () {
      final r = MaintenanceRequestDto.fromJson({
        'id': 'r1',
        'description': 'Leak',
        'status': 'IN_PROGRESS',
        'priority': 'HIGH',
        'createdAt': '2026-04-01T00:00:00.000Z',
        'unit': {'code': 'A-1'},
        'category': {
          'name': {'ar': 'سباكة', 'en': 'Plumbing'},
        },
      }).toEntity();
      expect(r.status, MaintenanceStatus.inProgress);
      expect(r.priority, MaintenancePriority.high);
      expect(r.unitCode, 'A-1');
      expect(r.categoryName?.en, 'Plumbing');
    });

    test('request without category/unit tolerated (create response shape)', () {
      final r = MaintenanceRequestDto.fromJson({
        'id': 'r2',
        'description': 'New',
        'status': 'OPEN',
        'priority': 'MEDIUM',
      }).toEntity();
      expect(r.categoryName, isNull);
      expect(r.unitCode, isNull);
    });

    test(
      'flattened localized string category name parses (no Map cast crash)',
      () {
        // Regression: locale interceptor flattens `{ar,en}` → a localized string.
        final c = MaintenanceCategoryDto.fromJson({
          'id': 'cat2',
          'name': 'سباكة',
        }).toEntity();
        expect(c.name.resolve('ar'), 'سباكة');
        expect(c.name.resolve('en'), 'سباكة');

        final r = MaintenanceRequestDto.fromJson({
          'id': 'r3',
          'description': 'Leak',
          'status': 'OPEN',
          'priority': 'LOW',
          'category': {'name': 'سباكة'},
        }).toEntity();
        expect(r.categoryName?.resolve('ar'), 'سباكة');
      },
    );
  });

  group('MaintenanceRepositoryImpl error mapping', () {
    test('404 → Err(notFound)', () async {
      final repo = MaintenanceRepositoryImpl(_ThrowingDataSource(404));
      final result = await repo.getMyRequests();
      expect(result.failureOrNull?.type, FailureType.notFound);
    });
  });

  group('MaintenanceRequestsCubit', () {
    test('empty → empty state', () async {
      final cubit = MaintenanceRequestsCubit(
        GetMyMaintenanceRequests(_FakeMaintenanceRepo()),
      );
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('success → data state', () async {
      final cubit = MaintenanceRequestsCubit(
        GetMyMaintenanceRequests(
          _FakeMaintenanceRepo(
            requests: Ok([
              const MaintenanceRequest(
                id: 'r1',
                description: 'Leak',
                status: MaintenanceStatus.open,
                priority: MaintenancePriority.high,
              ),
            ]),
          ),
        ),
      );
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
      expect(cubit.state.data, hasLength(1));
    });
  });

  group('CreateMaintenanceCubit', () {
    CreateMaintenanceCubit make(
      _FakeMaintenanceRepo repo, {
      MyPropertyRepository? propertyRepo,
      PhotoPicker? picker,
      String? initialUnitId,
    }) => CreateMaintenanceCubit(
      GetMaintenanceCategories(repo),
      GetMyProperties(propertyRepo ?? _FakePropertyRepo(const Ok([]))),
      CreateMaintenanceRequest(repo),
      UploadMaintenancePhoto(repo),
      picker ?? _FakePhotoPicker(),
      initialUnitId: initialUnitId,
    );

    _FakeMaintenanceRepo repoWithCat({
      Result<MaintenanceRequest>? createResult,
      List<Result<void>>? uploadResults,
    }) => _FakeMaintenanceRepo(
      categories: Ok([
        const MaintenanceCategory(
          id: 'cat1',
          name: Translatable(ar: '', en: 'Plumbing'),
        ),
      ]),
      createResult: createResult,
      uploadResults: uploadResults,
    );

    test(
      'fixed unit skips unit loading and is valid after category+desc',
      () async {
        final repo = repoWithCat();
        final cubit = make(repo, initialUnitId: 'u1');
        await cubit.load();
        expect(cubit.state.fixedUnit, isTrue);
        expect(cubit.state.unitsStatus, DataStatus.initial); // never loaded
        expect(cubit.state.isValid, isFalse);

        cubit.toggleCategory('cat1');
        cubit.setDescription('Water leak in kitchen');
        expect(cubit.state.isValid, isTrue);

        await cubit.submit();
        expect(cubit.state.submitted, isTrue);
        expect(repo.createCalls, 1);
        expect(repo.lastCreate?.unitId, 'u1');
        expect(repo.lastCreate?.categoryIds, ['cat1']);
      },
    );

    test('invalid submit surfaces validation, does not call backend', () async {
      final repo = repoWithCat();
      final cubit = make(repo, initialUnitId: 'u1');
      await cubit.load();
      await cubit.submit();
      expect(cubit.state.showValidation, isTrue);
      expect(cubit.state.submitted, isFalse);
      expect(repo.createCalls, 0);
    });

    test('no fixed unit loads units and auto-selects the only one', () async {
      final repo = repoWithCat();
      final cubit = make(
        repo,
        propertyRepo: _FakePropertyRepo(Ok([_property('u9')])),
      );
      await cubit.load();
      expect(cubit.state.unitsStatus, DataStatus.success);
      expect(cubit.state.selectedUnitId, 'u9');
    });

    test('submit failure surfaces failure without marking submitted', () async {
      final repo = repoWithCat(
        createResult: Result.err(AppFailure(type: FailureType.validation)),
      );
      final cubit = make(repo, initialUnitId: 'u1');
      await cubit.load();
      cubit.toggleCategory('cat1');
      cubit.setDescription('Broken door lock');
      await cubit.submit();
      expect(cubit.state.submitted, isFalse);
      expect(cubit.state.submitFailure?.type, FailureType.validation);
    });

    group('photo selection / validation', () {
      Future<CreateMaintenanceCubit> ready(PhotoPicker picker) async {
        final cubit = make(repoWithCat(), picker: picker, initialUnitId: 'u1');
        await cubit.load();
        return cubit;
      }

      test('accepts valid gallery photos', () async {
        final cubit = await ready(
          _FakePhotoPicker(
            gallery: [
              _photo(),
              _photo(name: 'b.png', mime: 'image/png'),
            ],
          ),
        );
        await cubit.addFromGallery();
        expect(cubit.state.photos, hasLength(2));
      });

      test('accepts a camera capture', () async {
        final cubit = await ready(
          _FakePhotoPicker(camera: _photo(name: 'cam.jpg')),
        );
        await cubit.addFromCamera();
        expect(cubit.state.photos, hasLength(1));
      });

      test('rejects unsupported type with a pick issue', () async {
        final cubit = await ready(
          _FakePhotoPicker(
            gallery: [_photo(mime: 'image/gif', name: 'a.gif')],
          ),
        );
        await cubit.addFromGallery();
        expect(cubit.state.photos, isEmpty);
        expect(cubit.state.pickIssue, PhotoPickIssue.unsupportedType);
      });

      test('rejects oversized files', () async {
        final cubit = await ready(
          _FakePhotoPicker(gallery: [_photo(size: kMaxPhotoBytes + 1)]),
        );
        await cubit.addFromGallery();
        expect(cubit.state.photos, isEmpty);
        expect(cubit.state.pickIssue, PhotoPickIssue.tooLarge);
      });

      test('caps at the max photo count', () async {
        final many = List.generate(
          kMaxPhotos + 2,
          (i) => _photo(name: 'p$i.jpg'),
        );
        final cubit = await ready(_FakePhotoPicker(gallery: many));
        await cubit.addFromGallery();
        expect(cubit.state.photos, hasLength(kMaxPhotos));
        expect(cubit.state.pickIssue, PhotoPickIssue.tooMany);
      });

      test('permission denial surfaces a friendly pick issue', () async {
        final cubit = await ready(
          _FakePhotoPicker(
            error: const PhotoPickerException(
              PhotoPickerErrorKind.permissionDenied,
            ),
          ),
        );
        await cubit.addFromGallery();
        expect(cubit.state.pickIssue, PhotoPickIssue.permissionDenied);
      });

      test('removePhoto drops a selected image', () async {
        final cubit = await ready(_FakePhotoPicker(gallery: [_photo()]));
        await cubit.addFromGallery();
        final id = cubit.state.photos.single.localId;
        cubit.removePhoto(id);
        expect(cubit.state.photos, isEmpty);
      });
    });

    group('photo upload', () {
      Future<CreateMaintenanceCubit> readyWithPhoto(
        _FakeMaintenanceRepo repo,
      ) async {
        final cubit = make(
          repo,
          picker: _FakePhotoPicker(gallery: [_photo()]),
          initialUnitId: 'u1',
        );
        await cubit.load();
        cubit.toggleCategory('cat1');
        cubit.setDescription('Cracked tile in bathroom');
        await cubit.addFromGallery();
        return cubit;
      }

      test('creates request then uploads photo → submitted', () async {
        final repo = repoWithCat();
        final cubit = await readyWithPhoto(repo);
        await cubit.submit();
        expect(repo.createCalls, 1);
        expect(repo.uploadCalls, 1);
        expect(repo.uploads.single.requestId, 'r1');
        expect(cubit.state.photos.single.status, PhotoStatus.uploaded);
        expect(cubit.state.submitted, isTrue);
      });

      test(
        'partial failure → phase partial, not submitted; retry succeeds',
        () async {
          // First upload fails, the retry (2nd call) succeeds.
          final repo = repoWithCat(
            uploadResults: [Result.err(AppFailure(type: FailureType.network))],
          );
          final cubit = await readyWithPhoto(repo);
          await cubit.submit();
          expect(cubit.state.phase, CreatePhase.partial);
          expect(cubit.state.submitted, isFalse);
          expect(cubit.state.failedPhotoCount, 1);
          expect(repo.createCalls, 1); // request created exactly once

          await cubit.retryFailedUploads();
          expect(repo.createCalls, 1); // never re-created
          expect(cubit.state.photos.single.status, PhotoStatus.uploaded);
          expect(cubit.state.submitted, isTrue);
        },
      );

      test('acceptPartial finishes without re-creating', () async {
        final repo = repoWithCat(
          uploadResults: [Result.err(AppFailure(type: FailureType.server))],
        );
        final cubit = await readyWithPhoto(repo);
        await cubit.submit();
        expect(cubit.state.phase, CreatePhase.partial);
        cubit.acceptPartial();
        expect(cubit.state.submitted, isTrue);
      });

      test('double submit while busy creates the request only once', () async {
        final repo = repoWithCat();
        final cubit = await readyWithPhoto(repo);
        await Future.wait([cubit.submit(), cubit.submit()]);
        expect(repo.createCalls, 1);
      });
    });
  });

  group('UploadMaintenancePhoto use case', () {
    test('delegates to repository.uploadPhoto', () async {
      final repo = _FakeMaintenanceRepo();
      final useCase = UploadMaintenancePhoto(repo);
      final result = await useCase(
        MaintenancePhotoUpload(
          requestId: 'r1',
          bytes: Uint8List.fromList([1]),
          contentType: 'image/jpeg',
          fileName: 'a.jpg',
          sizeBytes: 1,
        ),
      );
      expect(result.isOk, isTrue);
      expect(repo.uploadCalls, 1);
    });
  });

  group('MaintenanceRepositoryImpl photo upload', () {
    test('presign → put → register success returns Ok', () async {
      final ds = _RecordingUploadDataSource();
      final repo = MaintenanceRepositoryImpl(ds);
      final result = await repo.uploadPhoto(
        MaintenancePhotoUpload(
          requestId: 'r1',
          bytes: Uint8List.fromList([1, 2, 3]),
          contentType: 'image/jpeg',
          fileName: 'a.jpg',
          sizeBytes: 3,
        ),
      );
      expect(result.isOk, isTrue);
      // The public (not signed) URL is what gets registered.
      expect(ds.registeredFileUrl, 'https://cdn.example/docs/x.jpg');
    });

    test('a failing PUT maps to Err and never registers', () async {
      final ds = _RecordingUploadDataSource(
        putError: DioException(
          requestOptions: RequestOptions(path: 'https://signed'),
          type: DioExceptionType.connectionError,
        ),
      );
      final repo = MaintenanceRepositoryImpl(ds);
      final result = await repo.uploadPhoto(
        MaintenancePhotoUpload(
          requestId: 'r1',
          bytes: Uint8List.fromList([1]),
          contentType: 'image/jpeg',
          fileName: 'a.jpg',
          sizeBytes: 1,
        ),
      );
      expect(result.failureOrNull?.type, FailureType.network);
      expect(ds.registerCalls, 0);
    });
  });

  group('Maintenance resolution loop (Phase A)', () {
    test('dto → entity maps the Phase A resolution fields', () {
      final r = MaintenanceRequestDto.fromJson({
        'id': 'r1',
        'description': 'Leak',
        'status': 'RESOLVED',
        'priority': 'HIGH',
        'dueAt': '2026-04-01T00:00:00.000Z',
        'complaintAt': '2026-04-03T00:00:00.000Z',
        'customerConfirmedResolutionAt': '2026-04-05T00:00:00.000Z',
        'resolvedBy': 'BOTH',
        'customerRating': 5,
        'customerRatingText': 'ممتاز',
      }).toEntity();
      expect(r.dueAt, isNotNull);
      expect(r.complaintAt, isNotNull);
      expect(r.resolvedBy, MaintenanceResolvedBy.both);
      expect(r.customerRating, 5);
      expect(r.customerRatingText, 'ممتاز');
      expect(r.customerHasConfirmed, isTrue);
    });

    test(
      'canConfirmResolution true on RESOLVED + unconfirmed, false once confirmed',
      () {
        const resolved = MaintenanceRequest(
          id: 'r1',
          description: 'x',
          status: MaintenanceStatus.resolved,
          priority: MaintenancePriority.medium,
        );
        expect(resolved.canConfirmResolution, isTrue);
        final confirmed = MaintenanceRequest(
          id: 'r1',
          description: 'x',
          status: MaintenanceStatus.resolved,
          priority: MaintenancePriority.medium,
          customerConfirmedResolutionAt: DateTime(2026, 4, 5),
        );
        expect(confirmed.canConfirmResolution, isFalse);
      },
    );

    test('canComplain true only ≥24h overdue and unresolved', () {
      final overdue = MaintenanceRequest(
        id: 'r1',
        description: 'x',
        status: MaintenanceStatus.inProgress,
        priority: MaintenancePriority.medium,
        dueAt: DateTime.now().subtract(const Duration(hours: 25)),
      );
      expect(overdue.canComplain, isTrue);
      expect(overdue.isOverdue, isTrue);

      final freshlyOverdue = MaintenanceRequest(
        id: 'r1',
        description: 'x',
        status: MaintenanceStatus.inProgress,
        priority: MaintenancePriority.medium,
        dueAt: DateTime.now().subtract(const Duration(hours: 1)),
      );
      expect(freshlyOverdue.canComplain, isFalse);
    });

    test(
      'detail cubit confirmResolution success emits the updated request',
      () async {
        const confirmed = MaintenanceRequest(
          id: 'r1',
          description: 'x',
          status: MaintenanceStatus.resolved,
          priority: MaintenancePriority.medium,
          customerRating: 5,
          resolvedBy: MaintenanceResolvedBy.customer,
        );
        // _FakeMaintenanceRepo.confirmResolution returns its createResult.
        final repo = _FakeMaintenanceRepo(createResult: const Ok(confirmed));
        final cubit = MaintenanceDetailCubit(
          initial: const MaintenanceRequest(
            id: 'r1',
            description: 'x',
            status: MaintenanceStatus.resolved,
            priority: MaintenancePriority.medium,
          ),
          confirmResolution: ConfirmMaintenanceResolution(repo),
          submitComplaint: SubmitMaintenanceComplaint(repo),
        );
        final failure = await cubit.confirmResolution(rating: 5);
        expect(failure, isNull);
        expect(cubit.state.submitting, isFalse);
        expect(cubit.state.request.customerRating, 5);
        expect(cubit.state.request.resolvedBy, MaintenanceResolvedBy.customer);
      },
    );

    test(
      'detail cubit surfaces failure and keeps the original request',
      () async {
        final repo = _FakeMaintenanceRepo(
          createResult: Result.err(AppFailure(type: FailureType.validation)),
        );
        final cubit = MaintenanceDetailCubit(
          initial: const MaintenanceRequest(
            id: 'r1',
            description: 'x',
            status: MaintenanceStatus.resolved,
            priority: MaintenancePriority.medium,
          ),
          confirmResolution: ConfirmMaintenanceResolution(repo),
          submitComplaint: SubmitMaintenanceComplaint(repo),
        );
        final failure = await cubit.confirmResolution(rating: 4);
        expect(failure?.type, FailureType.validation);
        expect(cubit.state.submitting, isFalse);
        expect(cubit.state.request.customerHasConfirmed, isFalse);
      },
    );
  });
}

class _ThrowingDataSource implements MaintenanceRemoteDataSource {
  _ThrowingDataSource(this.status);
  final int status;

  DioException get _e => DioException(
    requestOptions: RequestOptions(path: '/me/maintenance-requests'),
    type: DioExceptionType.badResponse,
    response: Response(
      requestOptions: RequestOptions(path: '/me/maintenance-requests'),
      statusCode: status,
    ),
  );

  @override
  Future<List<MaintenanceCategoryDto>> listCategories() async => throw _e;
  @override
  Future<List<MaintenanceRequestDto>> listMyRequests() async => throw _e;
  @override
  Future<MaintenanceRequestDto> createRequest({
    required String unitId,
    required List<String> categoryIds,
    required String description,
  }) async => throw _e;
  @override
  Future<PresignResponseDto> presignPhoto({
    required String requestId,
    required String contentType,
    required int sizeBytes,
    required String fileName,
  }) async => throw _e;
  @override
  Future<void> putToSignedUrl({
    required String uploadUrl,
    required Uint8List bytes,
    required String contentType,
    void Function(double progress)? onProgress,
  }) async => throw _e;
  @override
  Future<void> registerPhoto({
    required String requestId,
    required String fileUrl,
    required String title,
    required String fileName,
    required String mimeType,
    required int sizeBytes,
  }) async => throw _e;
  @override
  Future<MaintenanceRequestDto> confirmResolution({
    required String requestId,
    required int rating,
    String? note,
  }) async => throw _e;
  @override
  Future<MaintenanceRequestDto> submitComplaint({
    required String requestId,
  }) async => throw _e;
}

/// Records the presign → PUT → register dance for orchestration tests.
class _RecordingUploadDataSource implements MaintenanceRemoteDataSource {
  _RecordingUploadDataSource({this.putError});
  final DioException? putError;

  int registerCalls = 0;
  String? registeredFileUrl;

  @override
  Future<PresignResponseDto> presignPhoto({
    required String requestId,
    required String contentType,
    required int sizeBytes,
    required String fileName,
  }) async => const PresignResponseDto(
    uploadUrl: 'https://signed.example/put?sig=secret',
    publicUrl: 'https://cdn.example/docs/x.jpg',
    key: 'docs/x.jpg',
  );

  @override
  Future<void> putToSignedUrl({
    required String uploadUrl,
    required Uint8List bytes,
    required String contentType,
    void Function(double progress)? onProgress,
  }) async {
    if (putError != null) throw putError!;
    onProgress?.call(1);
  }

  @override
  Future<void> registerPhoto({
    required String requestId,
    required String fileUrl,
    required String title,
    required String fileName,
    required String mimeType,
    required int sizeBytes,
  }) async {
    registerCalls++;
    registeredFileUrl = fileUrl;
  }

  @override
  Future<List<MaintenanceCategoryDto>> listCategories() async => const [];
  @override
  Future<List<MaintenanceRequestDto>> listMyRequests() async => const [];
  @override
  Future<MaintenanceRequestDto> createRequest({
    required String unitId,
    required List<String> categoryIds,
    required String description,
  }) async => throw UnimplementedError();
  @override
  Future<MaintenanceRequestDto> confirmResolution({
    required String requestId,
    required int rating,
    String? note,
  }) async => throw UnimplementedError();
  @override
  Future<MaintenanceRequestDto> submitComplaint({
    required String requestId,
  }) async => throw UnimplementedError();
}
