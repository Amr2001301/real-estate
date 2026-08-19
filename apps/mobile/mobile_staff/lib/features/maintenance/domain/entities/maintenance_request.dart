import 'package:core/core_domain.dart';

/// Lifecycle status (matches backend MaintenanceStatus).
enum MaintenanceStatus {
  open('OPEN'),
  assigned('ASSIGNED'),
  inProgress('IN_PROGRESS'),
  resolved('RESOLVED'),
  closed('CLOSED'),
  unknown('');

  const MaintenanceStatus(this.wire);
  final String wire;

  static MaintenanceStatus fromWire(String? wire) =>
      values.firstWhere((s) => s.wire == wire, orElse: () => MaintenanceStatus.unknown);
}

enum MaintenancePriority {
  low('LOW'),
  medium('MEDIUM'),
  high('HIGH'),
  urgent('URGENT'),
  unknown('');

  const MaintenancePriority(this.wire);
  final String wire;

  static MaintenancePriority fromWire(String? wire) =>
      values.firstWhere((p) => p.wire == wire, orElse: () => MaintenancePriority.unknown);
}

/// Who confirmed resolution (`null` → nobody yet).
enum MaintenanceResolvedBy {
  customer('CUSTOMER'),
  supervisor('SUPERVISOR'),
  both('BOTH');

  const MaintenanceResolvedBy(this.wire);
  final String wire;

  static MaintenanceResolvedBy? fromWire(String? wire) {
    if (wire == null || wire.isEmpty) return null;
    for (final v in values) {
      if (v.wire == wire) return v;
    }
    return null;
  }
}

/// Warranty status snapshotted at request creation.
enum MaintenanceWarrantyStatus {
  inWarranty('IN_WARRANTY'),
  outOfWarranty('OUT_OF_WARRANTY'),
  unknown('UNKNOWN');

  const MaintenanceWarrantyStatus(this.wire);
  final String wire;

  static MaintenanceWarrantyStatus? fromWire(String? wire) {
    if (wire == null || wire.isEmpty) return null;
    for (final v in values) {
      if (v.wire == wire) return v;
    }
    return null;
  }
}

/// Status transitions a supervisor may drive (mirrors backend
/// SUPERVISOR_TRANSITIONS; the backend re-validates).
enum MaintenanceTransition {
  start(MaintenanceStatus.inProgress),
  resolve(MaintenanceStatus.resolved),
  reopen(MaintenanceStatus.inProgress);

  const MaintenanceTransition(this.target);
  final MaintenanceStatus target;
}

/// An assigned maintenance request (list row + detail base).
class MaintenanceRequest extends Equatable {
  const MaintenanceRequest({
    required this.id,
    required this.description,
    required this.status,
    required this.priority,
    this.reviewStatus,
    this.customerName,
    this.customerPhone,
    this.customerEmail,
    this.unitCode,
    this.unitLat,
    this.unitLng,
    this.unitAddress,
    this.categoryName,
    this.warrantyStatus,
    this.warrantyEndSnapshot,
    this.itemName,
    this.createdAt,
    this.approvedAt,
    this.assignedAt,
    this.dueAt,
    this.resolvedAt,
    this.closedAt,
    this.complaintAt,
    this.unresolvedAt,
    this.customerConfirmedResolutionAt,
    this.supervisorConfirmedResolutionAt,
    this.resolvedBy,
    this.customerRating,
    this.customerRatingText,
    this.customerRatingSubmittedAt,
  });

  final String id;
  final String description;
  final MaintenanceStatus status;
  final MaintenancePriority priority;
  final String? reviewStatus;
  final String? customerName;
  final String? customerPhone;
  final String? customerEmail;
  final String? unitCode;
  final double? unitLat;
  final double? unitLng;
  final String? unitAddress;
  final Translatable? categoryName;
  final MaintenanceWarrantyStatus? warrantyStatus;
  final DateTime? warrantyEndSnapshot;
  final Translatable? itemName;
  final DateTime? createdAt;
  final DateTime? approvedAt;
  final DateTime? assignedAt;
  final DateTime? dueAt;
  final DateTime? resolvedAt;
  final DateTime? closedAt;
  final DateTime? complaintAt;
  final DateTime? unresolvedAt;
  final DateTime? customerConfirmedResolutionAt;
  final DateTime? supervisorConfirmedResolutionAt;
  final MaintenanceResolvedBy? resolvedBy;
  final int? customerRating;
  final String? customerRatingText;
  final DateTime? customerRatingSubmittedAt;

  bool get _isClosedish =>
      status == MaintenanceStatus.resolved || status == MaintenanceStatus.closed;

  bool get isOverdue =>
      !_isClosedish && dueAt != null && dueAt!.isBefore(DateTime.now());

  Duration get overdueBy => isOverdue ? DateTime.now().difference(dueAt!) : Duration.zero;

  bool get supervisorHasConfirmed => supervisorConfirmedResolutionAt != null;

  /// Supervisor may explicitly confirm once the request is resolved/closed.
  bool get canSupervisorConfirm => _isClosedish && supervisorConfirmedResolutionAt == null;

  /// Transitions allowed from the current status (supervisor subset).
  List<MaintenanceTransition> get allowedTransitions => switch (status) {
        MaintenanceStatus.assigned => const [MaintenanceTransition.start],
        MaintenanceStatus.inProgress => const [MaintenanceTransition.resolve],
        MaintenanceStatus.resolved => const [MaintenanceTransition.reopen],
        _ => const [],
      };

  @override
  List<Object?> get props => [
        id,
        status,
        priority,
        description,
        dueAt,
        complaintAt,
        unresolvedAt,
        supervisorConfirmedResolutionAt,
        resolvedBy,
        customerRating,
      ];
}

/// A read-only attachment summary on the detail response.
class MaintenanceDoc extends Equatable {
  const MaintenanceDoc({
    required this.id,
    this.title,
    this.fileName,
    this.url,
    this.mimeType,
  });
  final String id;
  final String? title;
  final String? fileName;
  final String? url;
  final String? mimeType;

  bool get isImage {
    if (mimeType?.startsWith('image/') == true) return true;
    final name = (fileName ?? '').toLowerCase();
    return name.endsWith('.jpg') || name.endsWith('.jpeg') ||
        name.endsWith('.png') || name.endsWith('.webp') ||
        name.endsWith('.gif');
  }

  @override
  List<Object?> get props => [id, title, fileName, url, mimeType];
}

/// Detail = the request + its attachments.
class MaintenanceDetail extends Equatable {
  const MaintenanceDetail({required this.request, this.documents = const []});
  final MaintenanceRequest request;
  final List<MaintenanceDoc> documents;

  @override
  List<Object?> get props => [request, documents];
}
