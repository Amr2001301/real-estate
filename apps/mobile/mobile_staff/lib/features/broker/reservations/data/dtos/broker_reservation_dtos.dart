// Wire shapes for /portal/reservations. Data layer only.

String? _projectName(Map<String, dynamic>? unit) {
  final project = ((unit?['building'] as Map<String, dynamic>?)?['phase']
      as Map<String, dynamic>?)?['project'] as Map<String, dynamic>?;
  final name = project?['name'];
  return name is Map ? ((name['ar'] as String?) ?? (name['en'] as String?)) : name as String?;
}

class BrokerReservationDto {
  const BrokerReservationDto({
    required this.id,
    required this.status,
    this.reservationNumber,
    this.expiresAt,
    this.createdAt,
    this.unitCode,
    this.projectName,
    this.clientName,
    this.leadName,
    this.bookingAmount,
  });

  final String id;
  final String status;
  final String? reservationNumber;
  final String? expiresAt;
  final String? createdAt;
  final String? unitCode;
  final String? projectName;
  final String? clientName;
  final String? leadName;
  final String? bookingAmount;

  factory BrokerReservationDto.fromJson(Map<String, dynamic> json) {
    final unit = json['unit'] as Map<String, dynamic>?;
    final client = json['client'] as Map<String, dynamic>?;
    final lead = json['lead'] as Map<String, dynamic>?;
    return BrokerReservationDto(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'PENDING',
      reservationNumber: json['reservationNumber'] as String?,
      expiresAt: json['expiresAt'] as String?,
      createdAt: json['createdAt'] as String?,
      unitCode: unit?['code'] as String?,
      projectName: _projectName(unit),
      clientName: client?['fullName'] as String?,
      leadName: lead?['fullName'] as String?,
      bookingAmount: json['bookingAmount']?.toString(),
    );
  }
}
