import 'dart:typed_data';

import 'package:core/core.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../my_property/domain/entities/property.dart';
import '../../my_property/domain/usecases/get_my_properties.dart';
import '../domain/entities/maintenance_category.dart';
import '../domain/repositories/maintenance_repository.dart';
import '../domain/usecases/maintenance_use_cases.dart';
import 'photo_picker.dart';

/// Minimum description length accepted by the backend (`@MinLength(5)`).
const kMaintenanceDescriptionMin = 5;

/// Photo attachment limits (mobile-side). The backend caps at 25 MiB and a
/// wider MIME set; we cap tighter for a snappy mobile upload experience.
const kMaxPhotos = 5;
const kMaxPhotoBytes = 10 * 1024 * 1024; // 10 MiB
const kAllowedPhotoTypes = {'image/jpeg', 'image/png', 'image/webp'};

/// Overall phase of the create flow.
enum CreatePhase { editing, creating, uploading, partial, done }

/// Per-photo upload lifecycle.
enum PhotoStatus { pending, uploading, uploaded, failed }

/// Why a pick attempt produced a (partial) rejection — surfaced as a one-shot
/// snackbar via [CreateMaintenanceState.pickNonce].
enum PhotoPickIssue { permissionDenied, tooMany, tooLarge, unsupportedType, unknown }

/// A selected photo and its upload status. Holds raw bytes (presentation/data
/// only — never reaches the domain except via [MaintenancePhotoUpload]).
class PhotoItem extends Equatable {
  const PhotoItem({
    required this.localId,
    required this.bytes,
    required this.fileName,
    required this.contentType,
    required this.sizeBytes,
    this.status = PhotoStatus.pending,
    this.progress = 0,
    this.failure,
  });

  final String localId;
  final Uint8List bytes;
  final String fileName;
  final String contentType;
  final int sizeBytes;
  final PhotoStatus status;
  final double progress;
  final AppFailure? failure;

  PhotoItem copyWith({
    PhotoStatus? status,
    double? progress,
    AppFailure? failure,
    bool clearFailure = false,
  }) {
    return PhotoItem(
      localId: localId,
      bytes: bytes,
      fileName: fileName,
      contentType: contentType,
      sizeBytes: sizeBytes,
      status: status ?? this.status,
      progress: progress ?? this.progress,
      failure: clearFailure ? null : (failure ?? this.failure),
    );
  }

  @override
  List<Object?> get props => [localId, status, progress, failure];
}

/// A selectable unit option for the create form (one of the customer's units).
class UnitOption extends Equatable {
  const UnitOption({required this.id, required this.projectName, required this.label});
  final String id;
  final Translatable projectName;
  final String label;

  @override
  List<Object?> get props => [id, label];
}

class CreateMaintenanceState extends Equatable {
  const CreateMaintenanceState({
    this.categoriesStatus = DataStatus.initial,
    this.categories = const [],
    this.categoriesFailure,
    this.unitsStatus = DataStatus.initial,
    this.units = const [],
    this.unitsFailure,
    this.selectedUnitId,
    this.fixedUnit = false,
    this.selectedCategoryIds = const {},
    this.description = '',
    this.photos = const [],
    this.phase = CreatePhase.editing,
    this.requestId,
    this.submitFailure,
    this.submitted = false,
    this.showValidation = false,
    this.pickIssue,
    this.pickNonce = 0,
  });

  final DataStatus categoriesStatus;
  final List<MaintenanceCategory> categories;
  final AppFailure? categoriesFailure;

  final DataStatus unitsStatus;
  final List<UnitOption> units;
  final AppFailure? unitsFailure;
  final String? selectedUnitId;
  final bool fixedUnit;

  final Set<String> selectedCategoryIds;
  final String description;

  final List<PhotoItem> photos;

  final CreatePhase phase;

  /// Set once the request is created, so a retry never creates a duplicate.
  final String? requestId;

  final AppFailure? submitFailure;
  final bool submitted;
  final bool showValidation;

  /// One-shot pick issue + a nonce so the UI shows exactly one snackbar per event.
  final PhotoPickIssue? pickIssue;
  final int pickNonce;

  bool get busy => phase == CreatePhase.creating || phase == CreatePhase.uploading;
  bool get hasUnit => (selectedUnitId ?? '').isNotEmpty;
  bool get hasCategory => selectedCategoryIds.isNotEmpty;
  bool get hasDescription => description.trim().length >= kMaintenanceDescriptionMin;
  bool get isValid => hasUnit && hasCategory && hasDescription;
  bool get canAddMorePhotos => photos.length < kMaxPhotos;
  int get failedPhotoCount =>
      photos.where((p) => p.status == PhotoStatus.failed).length;

  CreateMaintenanceState copyWith({
    DataStatus? categoriesStatus,
    List<MaintenanceCategory>? categories,
    AppFailure? categoriesFailure,
    DataStatus? unitsStatus,
    List<UnitOption>? units,
    AppFailure? unitsFailure,
    String? selectedUnitId,
    bool? fixedUnit,
    Set<String>? selectedCategoryIds,
    String? description,
    List<PhotoItem>? photos,
    CreatePhase? phase,
    String? requestId,
    AppFailure? submitFailure,
    bool? submitted,
    bool? showValidation,
    PhotoPickIssue? pickIssue,
    int? pickNonce,
    bool clearSubmitFailure = false,
    bool clearPickIssue = false,
  }) {
    return CreateMaintenanceState(
      categoriesStatus: categoriesStatus ?? this.categoriesStatus,
      categories: categories ?? this.categories,
      categoriesFailure: categoriesFailure ?? this.categoriesFailure,
      unitsStatus: unitsStatus ?? this.unitsStatus,
      units: units ?? this.units,
      unitsFailure: unitsFailure ?? this.unitsFailure,
      selectedUnitId: selectedUnitId ?? this.selectedUnitId,
      fixedUnit: fixedUnit ?? this.fixedUnit,
      selectedCategoryIds: selectedCategoryIds ?? this.selectedCategoryIds,
      description: description ?? this.description,
      photos: photos ?? this.photos,
      phase: phase ?? this.phase,
      requestId: requestId ?? this.requestId,
      submitFailure: clearSubmitFailure ? null : (submitFailure ?? this.submitFailure),
      submitted: submitted ?? this.submitted,
      showValidation: showValidation ?? this.showValidation,
      pickIssue: clearPickIssue ? null : (pickIssue ?? this.pickIssue),
      pickNonce: pickNonce ?? this.pickNonce,
    );
  }

  @override
  List<Object?> get props => [
        categoriesStatus,
        categories,
        categoriesFailure,
        unitsStatus,
        units,
        unitsFailure,
        selectedUnitId,
        fixedUnit,
        selectedCategoryIds,
        description,
        photos,
        phase,
        requestId,
        submitFailure,
        submitted,
        showValidation,
        pickIssue,
        pickNonce,
      ];
}

/// Drives the "new maintenance request" form: unit + category + description,
/// optional photo attachments, and the create → upload → register flow with
/// per-photo progress and retry of failures.
class CreateMaintenanceCubit extends Cubit<CreateMaintenanceState> {
  CreateMaintenanceCubit(
    this._getCategories,
    this._getMyProperties,
    this._createRequest,
    this._uploadPhoto,
    this._picker, {
    String? initialUnitId,
  }) : super(CreateMaintenanceState(
          fixedUnit: (initialUnitId ?? '').isNotEmpty,
          selectedUnitId: initialUnitId,
        ));

  final GetMaintenanceCategories _getCategories;
  final GetMyProperties _getMyProperties;
  final CreateMaintenanceRequest _createRequest;
  final UploadMaintenancePhoto _uploadPhoto;
  final PhotoPicker _picker;

  int _photoSeq = 0;

  Future<void> load() async {
    await Future.wait([loadCategories(), if (!state.fixedUnit) loadUnits()]);
  }

  Future<void> loadCategories() async {
    emit(state.copyWith(categoriesStatus: DataStatus.loading));
    final result = await _getCategories(const NoParams());
    result.when(
      ok: (categories) => emit(state.copyWith(
        categoriesStatus: categories.isEmpty ? DataStatus.empty : DataStatus.success,
        categories: categories,
      )),
      err: (failure) => emit(state.copyWith(
        categoriesStatus: DataStatus.failure,
        categoriesFailure: failure,
      )),
    );
  }

  Future<void> loadUnits() async {
    emit(state.copyWith(unitsStatus: DataStatus.loading));
    final result = await _getMyProperties(const NoParams());
    result.when(
      ok: (properties) {
        final options = _toOptions(properties);
        emit(state.copyWith(
          unitsStatus: options.isEmpty ? DataStatus.empty : DataStatus.success,
          units: options,
          selectedUnitId: options.length == 1 ? options.single.id : state.selectedUnitId,
        ));
      },
      err: (failure) => emit(state.copyWith(
        unitsStatus: DataStatus.failure,
        unitsFailure: failure,
      )),
    );
  }

  List<UnitOption> _toOptions(List<Property> properties) {
    final seen = <String>{};
    final options = <UnitOption>[];
    for (final p in properties) {
      if (p.unitId.isEmpty || !seen.add(p.unitId)) continue;
      options.add(UnitOption(
        id: p.unitId,
        projectName: p.projectName,
        label: '${p.unitType} · ${p.unitCode}',
      ));
    }
    return options;
  }

  void selectUnit(String id) => emit(state.copyWith(selectedUnitId: id));

  void toggleCategory(String id) {
    final next = Set<String>.from(state.selectedCategoryIds);
    next.contains(id) ? next.remove(id) : next.add(id);
    emit(state.copyWith(selectedCategoryIds: next));
  }

  void setDescription(String value) => emit(state.copyWith(description: value));

  // ── Photo selection ─────────────────────────────────────────────────────

  Future<void> addFromGallery() async {
    if (state.busy) return;
    final remaining = kMaxPhotos - state.photos.length;
    if (remaining <= 0) return _emitPickIssue(PhotoPickIssue.tooMany);
    try {
      final picked = await _picker.pickFromGallery(limit: remaining);
      _ingest(picked);
    } on PhotoPickerException catch (e) {
      _emitPickIssue(_issueFor(e.kind));
    }
  }

  Future<void> addFromCamera() async {
    if (state.busy) return;
    if (!state.canAddMorePhotos) return _emitPickIssue(PhotoPickIssue.tooMany);
    try {
      final photo = await _picker.captureFromCamera();
      if (photo != null) _ingest([photo]);
    } on PhotoPickerException catch (e) {
      _emitPickIssue(_issueFor(e.kind));
    }
  }

  void removePhoto(String localId) {
    if (state.busy) return;
    emit(state.copyWith(
      photos: state.photos.where((p) => p.localId != localId).toList(),
    ));
  }

  void clearPickIssue() => emit(state.copyWith(clearPickIssue: true));

  /// Validate + add picked photos, reporting the first rejection reason.
  void _ingest(List<PickedPhoto> picked) {
    final accepted = <PhotoItem>[...state.photos];
    PhotoPickIssue? issue;
    for (final p in picked) {
      if (accepted.length >= kMaxPhotos) {
        issue = PhotoPickIssue.tooMany;
        break;
      }
      final type = p.mimeType.toLowerCase();
      if (!kAllowedPhotoTypes.contains(type)) {
        issue = PhotoPickIssue.unsupportedType;
        continue;
      }
      if (p.sizeBytes > kMaxPhotoBytes) {
        issue = PhotoPickIssue.tooLarge;
        continue;
      }
      accepted.add(PhotoItem(
        localId: 'p${_photoSeq++}',
        bytes: p.bytes,
        fileName: p.fileName,
        contentType: type,
        sizeBytes: p.sizeBytes,
      ));
    }
    emit(state.copyWith(photos: accepted));
    if (issue != null) _emitPickIssue(issue);
  }

  void _emitPickIssue(PhotoPickIssue issue) =>
      emit(state.copyWith(pickIssue: issue, pickNonce: state.pickNonce + 1));

  PhotoPickIssue _issueFor(PhotoPickerErrorKind kind) =>
      kind == PhotoPickerErrorKind.permissionDenied
          ? PhotoPickIssue.permissionDenied
          : PhotoPickIssue.unknown;

  // ── Submit / upload ───────────────────────────────────────────────────────

  Future<void> submit() async {
    if (state.busy) return; // double-tap guard
    // Create the request once; a retry only re-uploads photos.
    if (state.requestId == null) {
      if (!state.isValid) {
        emit(state.copyWith(showValidation: true));
        return;
      }
      emit(state.copyWith(phase: CreatePhase.creating, clearSubmitFailure: true));
      final result = await _createRequest(NewMaintenanceRequest(
        unitId: state.selectedUnitId!,
        categoryIds: state.selectedCategoryIds.toList(),
        description: state.description.trim(),
      ));
      final created = result.dataOrNull;
      if (created == null) {
        emit(state.copyWith(
          phase: CreatePhase.editing,
          submitFailure: result.failureOrNull,
        ));
        return;
      }
      emit(state.copyWith(requestId: created.id));
    }
    await _uploadOutstanding();
  }

  /// Re-upload only the photos that previously failed (request already exists).
  Future<void> retryFailedUploads() async {
    if (state.busy || state.requestId == null) return;
    await _uploadOutstanding();
  }

  /// Accept a partial result (request created, some photos failed) and finish.
  void acceptPartial() => emit(state.copyWith(submitted: true));

  Future<void> _uploadOutstanding() async {
    final pending =
        state.photos.where((p) => p.status != PhotoStatus.uploaded).toList();
    if (pending.isEmpty) {
      emit(state.copyWith(phase: CreatePhase.done, submitted: true));
      return;
    }
    emit(state.copyWith(phase: CreatePhase.uploading));
    for (final photo in pending) {
      await _uploadOne(photo);
    }
    final anyFailed = state.photos.any((p) => p.status == PhotoStatus.failed);
    emit(state.copyWith(
      phase: anyFailed ? CreatePhase.partial : CreatePhase.done,
      submitted: !anyFailed,
    ));
  }

  Future<void> _uploadOne(PhotoItem photo) async {
    _setPhoto(photo.localId,
        (p) => p.copyWith(status: PhotoStatus.uploading, progress: 0, clearFailure: true));
    final result = await _uploadPhoto(MaintenancePhotoUpload(
      requestId: state.requestId!,
      bytes: photo.bytes,
      contentType: photo.contentType,
      fileName: photo.fileName,
      sizeBytes: photo.sizeBytes,
      onProgress: (p) =>
          _setPhoto(photo.localId, (x) => x.copyWith(progress: p)),
    ));
    result.when(
      ok: (_) => _setPhoto(
          photo.localId, (p) => p.copyWith(status: PhotoStatus.uploaded, progress: 1)),
      err: (f) => _setPhoto(
          photo.localId, (p) => p.copyWith(status: PhotoStatus.failed, failure: f)),
    );
  }

  void _setPhoto(String localId, PhotoItem Function(PhotoItem) update) {
    emit(state.copyWith(photos: [
      for (final p in state.photos)
        if (p.localId == localId) update(p) else p,
    ]));
  }
}
