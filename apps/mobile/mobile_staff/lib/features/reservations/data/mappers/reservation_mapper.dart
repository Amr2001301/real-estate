import '../../domain/entities/reservation.dart';
import '../dtos/reservation_dtos.dart';

DateTime? _d(String? s) => DateTime.tryParse(s ?? '');

extension ReservationDtoMapper on ReservationDto {
  Reservation toEntity() => Reservation(
        id: id,
        status: status,
        reservationNumber: reservationNumber,
        expiresAt: _d(expiresAt),
        createdAt: _d(createdAt),
        clientName: clientName,
        clientPhone: clientPhone,
        projectName: projectName,
        unitCode: unitCode,
        bookingAmount: bookingAmount,
      );
}

extension ReservationDetailDtoMapper on ReservationDetailDto {
  ReservationDetail toEntity() {
    final entries = <ReservationTimelineEntry>[
      for (final n in notes)
        ReservationTimelineEntry(
          id: n.id,
          body: n.body,
          isNote: true,
          authorName: n.authorName,
          createdAt: _d(n.createdAt),
        ),
      for (final a in activities)
        ReservationTimelineEntry(
          id: a.id,
          body: a.status,
          isNote: false,
          createdAt: _d(a.createdAt),
        ),
    ]..sort((a, b) {
        final at = a.createdAt, bt = b.createdAt;
        if (at == null && bt == null) return 0;
        if (at == null) return 1;
        if (bt == null) return -1;
        return bt.compareTo(at);
      });
    return ReservationDetail(
      reservation: reservation.toEntity(),
      timeline: entries,
      planName: planName,
    );
  }
}
