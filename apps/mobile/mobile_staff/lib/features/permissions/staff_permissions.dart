import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// PRM in the staff app — the permission codes the company gave this account
/// (GET /me/permissions). As on the dashboard, a code opens its page to a
/// rep whose role would not see it; the API checks the same code.
class StaffPermissions extends Equatable {
  const StaffPermissions([this.codes = const {}]);
  final Set<String> codes;

  bool has(String code) => codes.contains(code);

  @override
  List<Object?> get props => [codes];
}

/// What each staff-app page needs: the roles that see it, or a code that opens it.
abstract final class StaffAccess {
  static bool _manager(AppRole? r) => r == AppRole.admin || r == AppRole.salesManager;

  /// «مراجعة الإيصالات» — the review queue (deposits:read:all).
  static bool paymentsReview(AppRole? r, StaffPermissions p) => _manager(r) || p.has('deposits:read:all');

  /// «الشيكات» (payment-instruments:manage). The admin, or whoever holds the
  /// code: the API asks a sales manager for the code too, and it is not in
  /// their starting set, so the role alone would open a page that answers 403.
  static bool cheques(AppRole? r, StaffPermissions p) => r == AppRole.admin || p.has('payment-instruments:manage');

  /// «الحملات» (campaigns:manage).
  static bool campaigns(AppRole? r, StaffPermissions p) => _manager(r) || p.has('campaigns:manage');
}

class StaffPermissionsCubit extends Cubit<StaffPermissions> {
  StaffPermissionsCubit(this._dio) : super(const StaffPermissions());
  final Dio _dio;

  Future<void> load() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/me/permissions');
      final codes = ((res.data?['codes'] as List?) ?? const []).whereType<String>().toSet();
      if (!isClosed) emit(StaffPermissions(codes));
    } catch (_) {
      // Keep what the role alone opens.
    }
  }

  /// Nothing extra after sign-out.
  void reset() {
    if (!isClosed) emit(const StaffPermissions());
  }
}
