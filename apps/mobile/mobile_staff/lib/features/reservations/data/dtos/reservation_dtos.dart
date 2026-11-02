// Wire shapes for the reservation endpoints. Data layer only.

String? _projectName(Map<String, dynamic>? unit) {
  final project = ((unit?['building'] as Map<String, dynamic>?)?['phase']
      as Map<String, dynamic>?)?['project'] as Map<String, dynamic>?;
  final name = project?['name'];
  return name is Map ? name['en'] as String? : name as String?;
}

class ReservationDto {
  const ReservationDto({
    required this.id,
    required this.status,
    this.reservationNumber,
    this.expiresAt,
    this.createdAt,
    this.clientName,
    this.clientPhone,
    this.projectName,
    this.unitCode,
    this.bookingAmount,
    this.salesId,
    this.salesName,
  });

  final String id;
  final String status;
  final String? reservationNumber;
  final String? expiresAt;
  final String? createdAt;
  final String? clientName;
  final String? clientPhone;
  final String? projectName;
  final String? unitCode;
  final String? bookingAmount;
  final String? salesId;
  final String? salesName;

  factory ReservationDto.fromJson(Map<String, dynamic> json) {
    final unit = json['unit'] as Map<String, dynamic>?;
    final client = json['client'] as Map<String, dynamic>?;
    final lead = json['lead'] as Map<String, dynamic>?;
    return ReservationDto(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'PENDING',
      reservationNumber: json['reservationNumber'] as String?,
      expiresAt: json['expiresAt'] as String?,
      createdAt: json['createdAt'] as String?,
      clientName: (client?['fullName'] as String?) ?? (lead?['fullName'] as String?),
      clientPhone: (client?['phone'] as String?) ?? (lead?['phone'] as String?),
      projectName: _projectName(unit),
      unitCode: unit?['code'] as String?,
      bookingAmount: json['bookingAmount']?.toString(),
      salesId: (json['salesId'] as String?) ?? ((json['sales'] as Map<String, dynamic>?)?['id'] as String?),
      salesName: (json['sales'] as Map<String, dynamic>?)?['fullName'] as String?,
    );
  }
}

class ReservationNoteDto {
  const ReservationNoteDto({required this.id, required this.body, this.authorName, this.createdAt});
  final String id;
  final String body;
  final String? authorName;
  final String? createdAt;

  factory ReservationNoteDto.fromJson(Map<String, dynamic> json) => ReservationNoteDto(
        id: json['id'] as String,
        body: json['body'] as String? ?? '',
        authorName: (json['author'] as Map<String, dynamic>?)?['fullName'] as String?,
        createdAt: json['createdAt'] as String?,
      );
}

class ReservationActivityDto {
  const ReservationActivityDto({required this.id, required this.status, this.createdAt});
  final String id;
  final String status;
  final String? createdAt;

  factory ReservationActivityDto.fromJson(Map<String, dynamic> json) => ReservationActivityDto(
        id: json['id'] as String,
        status: (json['status'] ?? json['type'] ?? 'activity').toString(),
        createdAt: json['createdAt'] as String?,
      );
}

class ReservationDetailDto {
  const ReservationDetailDto({
    required this.reservation,
    required this.notes,
    required this.activities,
    this.planName,
  });

  final ReservationDto reservation;
  final List<ReservationNoteDto> notes;
  final List<ReservationActivityDto> activities;
  final String? planName;

  factory ReservationDetailDto.fromJson(Map<String, dynamic> json) {
    final plan = json['installmentPlanTemplate'] as Map<String, dynamic>? ??
        json['plan'] as Map<String, dynamic>?;
    final planName = plan?['name'];
    return ReservationDetailDto(
      reservation: ReservationDto.fromJson(json),
      planName: planName is Map ? planName['en'] as String? : planName as String?,
      // The notes thread is `reservationNotes`; `notes` is the reservation's
      // own text (a string), kept as a list only by older responses.
      notes: ((json['reservationNotes'] ?? json['notes']) is List
              ? (json['reservationNotes'] ?? json['notes']) as List
              : const [])
          .whereType<Map<String, dynamic>>()
          .map(ReservationNoteDto.fromJson)
          .toList(),
      activities: ((json['activities'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ReservationActivityDto.fromJson)
          .toList(),
    );
  }
}
