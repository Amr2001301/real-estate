import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../reservations/view/reservations_data.dart';

/// The broker's commission on a booking: the rate and amount locked when
/// it was made (the portal sends none to an agent who may not see money).
class BrokerBookingCommission extends Equatable {
  const BrokerBookingCommission({this.pct, this.amount});
  final double? pct;
  final double? amount;

  @override
  List<Object?> get props => [pct, amount];
}

/// One of the broker's bookings, as the portal's bookings page.
class BrokerBooking extends Equatable {
  const BrokerBooking({required this.row, this.commission});
  final ReservationRow row;
  final BrokerBookingCommission? commission;

  factory BrokerBooking.fromJson(Map<String, dynamic> j) {
    final pct = readAmount(j['commissionLockedPct']);
    final amount = readAmount(j['commissionLockedAmount']);
    return BrokerBooking(
      row: ReservationRow.fromJson(j),
      commission: pct == null && amount == null ? null : BrokerBookingCommission(pct: pct, amount: amount),
    );
  }

  bool matches(String q) {
    final s = q.trim().toLowerCase();
    if (s.isEmpty) return true;
    return [row.clientName, row.clientPhone, row.number, row.unitCode].any((v) => (v ?? '').toLowerCase().contains(s));
  }

  @override
  List<Object?> get props => [row, commission];
}

/// A booking with its journey, for the page; and the contract it became,
/// found among the broker's contracts (the portal does not link it).
class BrokerBookingPage extends Equatable {
  const BrokerBookingPage({required this.page, this.commission, this.contractId, this.contractNumber});
  final ReservationPage page;
  final BrokerBookingCommission? commission;
  final String? contractId;
  final String? contractNumber;

  @override
  List<Object?> get props => [page, commission, contractId];
}

class BrokerBookingsRepository {
  BrokerBookingsRepository(this._dio);
  final Dio _dio;

  /// Every booking the broker may see: a broker's book is short, so it is
  /// read whole and filtered and searched on the phone.
  Future<Result<List<BrokerBooking>>> all() => guardApiCall(() async {
        final out = <BrokerBooking>[];
        for (var page = 1; page <= 20; page++) {
          final r = await _dio.get<Map<String, dynamic>>('/portal/reservations', queryParameters: {'page': page, 'pageSize': 100});
          final rows = ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>();
          out.addAll(rows.map(BrokerBooking.fromJson));
          final total = ((r.data?['meta'] as Map?)?['total'] as num?)?.toInt() ?? out.length;
          if (rows.isEmpty || out.length >= total) break;
        }
        return out;
      });

  Future<Result<BrokerBookingPage>> one(String id) => guardApiCall(() async {
        final r = await _dio.get<Map<String, dynamic>>('/portal/reservations/$id');
        final j = r.data ?? const <String, dynamic>{};
        final page = ReservationPage.parse(j);
        final booking = BrokerBooking.fromJson(j);
        String? contractId = page.contractId;
        String? contractNumber = page.contractNumber;
        if (contractId == null && page.row.status == 'CONVERTED' && page.row.number != null) {
          try {
            final c = await _dio.get<Map<String, dynamic>>('/portal/contracts', queryParameters: {'pageSize': 100});
            for (final m in ((c.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>()) {
              if ((m['reservation'] as Map?)?['reservationNumber'] == page.row.number) {
                contractId = '${m['id']}';
                contractNumber = m['contractNumber'] as String?;
                break;
              }
            }
          } catch (_) {
            // The link is a nicety; the page stands without it.
          }
        }
        return BrokerBookingPage(page: page, commission: booking.commission, contractId: contractId, contractNumber: contractNumber);
      });
}

class BrokerBookingsState extends Equatable {
  const BrokerBookingsState({this.data = const DataState.initial(), this.filter, this.search = ''});
  final DataState<List<BrokerBooking>> data;

  /// PENDING, APPROVED, CONVERTED or null.
  final String? filter;
  final String search;

  List<BrokerBooking> get all => data.data ?? const [];
  int count(String status) => all.where((b) => b.row.status == status).length;
  int get converted => count('CONVERTED');
  double get commission => all.fold(0, (s, b) => s + (b.commission?.amount ?? 0));
  bool get hasCommission => all.any((b) => b.commission != null);

  List<BrokerBooking> get shown => all.where((b) => filter == null || b.row.status == filter).where((b) => b.matches(search)).toList();

  BrokerBookingsState copyWith({DataState<List<BrokerBooking>>? data, String? Function()? filter, String? search}) =>
      BrokerBookingsState(data: data ?? this.data, filter: filter == null ? this.filter : filter(), search: search ?? this.search);

  @override
  List<Object?> get props => [data, filter, search];
}

class BrokerBookingsCubit extends Cubit<BrokerBookingsState> {
  BrokerBookingsCubit(this._repo) : super(const BrokerBookingsState());
  final BrokerBookingsRepository _repo;

  Future<void> load() async {
    emit(state.copyWith(data: DataState.loading(previousData: state.data.data)));
    final r = await _repo.all();
    if (isClosed) return;
    r.when(
      ok: (l) => emit(state.copyWith(data: l.isEmpty ? const DataState.empty() : DataState.success(l))),
      err: (f) => emit(state.copyWith(data: DataState.failure(f, previousData: state.data.data))),
    );
  }

  void setFilter(String? f) => emit(state.copyWith(filter: () => state.filter == f ? null : f));
  void setSearch(String q) => emit(state.copyWith(search: q));
}

class BrokerBookingCubit extends Cubit<DataState<BrokerBookingPage>> {
  BrokerBookingCubit(this._repo, {required this.reservationId}) : super(const DataState.initial());
  final BrokerBookingsRepository _repo;
  final String reservationId;

  Future<void> load() async {
    emit(DataState.loading(previousData: state.data));
    final r = await _repo.one(reservationId);
    if (isClosed) return;
    r.when(ok: (p) => emit(DataState.success(p)), err: (f) => emit(DataState.failure(f, previousData: state.data)));
  }
}
