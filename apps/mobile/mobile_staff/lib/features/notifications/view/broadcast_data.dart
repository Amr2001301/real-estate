import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../contracts/create/contract_create_data.dart' show PickHit;

enum BroadcastTarget { allCustomers, allBrokers, allSales, allSupervisors, allActive, role, user }

const _targetWire = {
  BroadcastTarget.allCustomers: 'ALL_CUSTOMERS',
  BroadcastTarget.allBrokers: 'ALL_BROKERS',
  BroadcastTarget.allSales: 'ALL_SALES',
  BroadcastTarget.allSupervisors: 'ALL_MAINTENANCE_SUPERVISORS',
  BroadcastTarget.allActive: 'ALL_ACTIVE',
  BroadcastTarget.role: 'ROLE',
  BroadcastTarget.user: 'USER',
};

/// Group sends: they need an estimate and a confirmation first.
bool isMassTarget(BroadcastTarget t) => t != BroadcastTarget.role && t != BroadcastTarget.user;

enum BroadcastChannel { inApp, push, both }

const _channelWire = {BroadcastChannel.inApp: 'IN_APP', BroadcastChannel.push: 'PUSH', BroadcastChannel.both: 'IN_APP_AND_PUSH'};

/// Who a send would reach: the audience and channel.
class BroadcastAudience extends Equatable {
  const BroadcastAudience({this.target = BroadcastTarget.allCustomers, this.channel = BroadcastChannel.inApp, this.role = 'CUSTOMER', this.userId, this.userName});
  final BroadcastTarget target;
  final BroadcastChannel channel;
  final String role;
  final String? userId;
  final String? userName;

  bool get complete => target != BroadcastTarget.user || userId != null;
  bool get needsDevices => channel != BroadcastChannel.inApp;

  Map<String, dynamic> toJson() => {
        'target': _targetWire[target],
        'channel': _channelWire[channel],
        if (target == BroadcastTarget.role) 'targetRole': role,
        if (target == BroadcastTarget.user && userId != null) 'targetUserId': userId,
      };

  @override
  List<Object?> get props => [target, channel, role, userId];
}

class BroadcastPreview extends Equatable {
  const BroadcastPreview({this.recipients = 0, this.pushEnabled = false, this.devices, this.withoutDevice});
  final int recipients;
  final bool pushEnabled;
  final int? devices;
  final int? withoutDevice;

  @override
  List<Object?> get props => [recipients, pushEnabled, devices, withoutDevice];
}

class BroadcastResult extends Equatable {
  const BroadcastResult({this.channel = BroadcastChannel.inApp, this.recipients = 0, this.created = 0, this.failed = 0, this.pushSent = 0, this.pushFailed = 0, this.noDevice = 0});
  final BroadcastChannel channel;
  final int recipients;
  final int created;
  final int failed;
  final int pushSent;
  final int pushFailed;
  final int noDevice;

  bool get usesInApp => channel != BroadcastChannel.push;
  bool get usesPush => channel != BroadcastChannel.inApp;

  /// 0 = everything arrived, 1 = some, 2 = nothing.
  int get outcome {
    final ok = (usesInApp ? created : 0) + (usesPush ? pushSent : 0);
    final bad = (usesInApp ? failed : 0) + (usesPush ? pushFailed : 0);
    if (ok == 0) return 2;
    return bad > 0 || (usesPush && noDevice > 0 && pushSent == 0) ? 1 : 0;
  }

  @override
  List<Object?> get props => [channel, recipients, created, failed, pushSent, pushFailed, noDevice];
}

/// The notification itself: both languages, and the page it opens.
class BroadcastContent extends Equatable {
  const BroadcastContent({this.titleAr = '', this.titleEn = '', this.bodyAr = '', this.bodyEn = '', this.entityType, this.entityId, this.entityLabel});
  final String titleAr;
  final String titleEn;
  final String bodyAr;
  final String bodyEn;
  final String? entityType;
  final String? entityId;
  final String? entityLabel;

  bool get complete => [titleAr, titleEn, bodyAr, bodyEn].every((s) => s.trim().isNotEmpty) && (entityType == null || entityId != null);

  Map<String, dynamic> toJson() => {
        'title_ar': titleAr.trim(),
        'title_en': titleEn.trim(),
        'body_ar': bodyAr.trim(),
        'body_en': bodyEn.trim(),
        if (entityType != null && entityId != null) ...{'entityType': entityType, 'entityId': entityId},
      };

  @override
  List<Object?> get props => [titleAr, titleEn, bodyAr, bodyEn, entityType, entityId];
}

class BroadcastRepository {
  BroadcastRepository(this._dio);
  final Dio _dio;

  Future<Result<BroadcastPreview>> preview(BroadcastAudience a) => guardApiCall(() async {
        final r = await _dio.post<Map<String, dynamic>>('/notifications/broadcast/preview', data: a.toJson());
        final d = r.data ?? const {};
        return BroadcastPreview(
          recipients: (d['recipientCount'] as num?)?.toInt() ?? 0,
          pushEnabled: d['pushEnabled'] == true,
          devices: (d['estimatedDeviceCount'] as num?)?.toInt(),
          withoutDevice: (d['usersWithoutDevices'] as num?)?.toInt(),
        );
      });

  Future<Result<BroadcastResult>> send(BroadcastAudience a, BroadcastContent c) => guardApiCall(() async {
        final r = await _dio.post<Map<String, dynamic>>('/notifications/broadcast', data: {...a.toJson(), ...c.toJson()});
        final d = r.data ?? const {};
        int n(String k) => (d[k] as num?)?.toInt() ?? 0;
        return BroadcastResult(
          channel: a.channel,
          recipients: n('recipientCount'),
          created: n('notificationRecordsCreated'),
          failed: n('failed'),
          pushSent: n('pushSent'),
          pushFailed: n('pushFailed'),
          noDevice: n('noDeviceTokens'),
        );
      });

  Future<List<PickHit>> searchUsers(String q) async {
    final r = await _dio.get<Map<String, dynamic>>('/users', queryParameters: {'pageSize': 20, 'active': true, if (q.trim().isNotEmpty) 'q': q.trim()});
    return [
      for (final u in ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>()) PickHit('${u['id']}', u['fullName'] as String? ?? '—', u['email'] as String?),
    ];
  }

  /// Records a notification can open (a contract, a booking or a lead).
  Future<List<PickHit>> searchRecords(String type, String q) async {
    final path = switch (type) { 'contract' => '/contracts', 'reservation' => '/reservations', _ => '/leads' };
    final r = await _dio.get<Map<String, dynamic>>(path, queryParameters: {'pageSize': 20, if (q.trim().isNotEmpty) 'q': q.trim()});
    return [
      for (final m in ((r.data?['data'] as List?) ?? const []).whereType<Map<String, dynamic>>())
        PickHit(
          '${m['id']}',
          (m['contractNumber'] ?? m['reservationNumber'] ?? m['fullName'] ?? '—') as String,
          ((m['customer'] ?? m['client'] ?? m['lead']) as Map?)?['fullName'] as String? ?? m['phone'] as String?,
        ),
    ];
  }
}

class BroadcastState extends Equatable {
  const BroadcastState({this.audience = const BroadcastAudience(), this.content = const BroadcastContent(), this.preview, this.previewing = false, this.sending = false, this.confirmed = false, this.result, this.failure});
  final BroadcastAudience audience;
  final BroadcastContent content;

  /// The estimate for the current audience and channel (cleared on any change to them).
  final BroadcastPreview? preview;
  final bool previewing;
  final bool sending;
  final bool confirmed;
  final BroadcastResult? result;
  final AppFailure? failure;

  bool get pushBlocked => audience.needsDevices && preview != null && !preview!.pushEnabled;

  /// Sendable: complete, estimated (always for a push or a group), confirmed for a group.
  bool get canSend {
    if (sending || !content.complete || !audience.complete) return false;
    final needsEstimate = isMassTarget(audience.target) || audience.needsDevices;
    if (needsEstimate && preview == null) return false;
    if (preview != null && preview!.recipients == 0) return false;
    if (pushBlocked) return false;
    if (isMassTarget(audience.target) && !confirmed) return false;
    return true;
  }

  BroadcastState copyWith({BroadcastAudience? audience, BroadcastContent? content, BroadcastPreview? Function()? preview, bool? previewing, bool? sending, bool? confirmed, BroadcastResult? Function()? result, AppFailure? Function()? failure}) =>
      BroadcastState(
        audience: audience ?? this.audience,
        content: content ?? this.content,
        preview: preview == null ? this.preview : preview(),
        previewing: previewing ?? this.previewing,
        sending: sending ?? this.sending,
        confirmed: confirmed ?? this.confirmed,
        result: result == null ? this.result : result(),
        failure: failure == null ? this.failure : failure(),
      );

  @override
  List<Object?> get props => [audience, content, preview, previewing, sending, confirmed, result, failure];
}

class BroadcastCubit extends Cubit<BroadcastState> {
  BroadcastCubit(this._repo) : super(const BroadcastState());
  final BroadcastRepository _repo;

  /// Changing who or how clears the estimate and the confirmation.
  void setAudience(BroadcastAudience a) => emit(state.copyWith(audience: a, preview: () => null, confirmed: false, failure: () => null));
  void setContent(BroadcastContent c) => emit(state.copyWith(content: c, failure: () => null));
  void setConfirmed(bool v) => emit(state.copyWith(confirmed: v));

  Future<void> estimate() async {
    if (!state.audience.complete) return;
    emit(state.copyWith(previewing: true, failure: () => null));
    final r = await _repo.preview(state.audience);
    if (isClosed) return;
    r.when(
      ok: (p) => emit(state.copyWith(previewing: false, preview: () => p, confirmed: false)),
      err: (f) => emit(state.copyWith(previewing: false, failure: () => f)),
    );
  }

  Future<void> send() async {
    if (!state.canSend) return;
    emit(state.copyWith(sending: true, failure: () => null, result: () => null));
    final r = await _repo.send(state.audience, state.content);
    if (isClosed) return;
    r.when(
      // The text is cleared after a send (the audience stays, for the next one).
      ok: (res) => emit(BroadcastState(audience: state.audience, result: res)),
      err: (f) => emit(state.copyWith(sending: false, failure: () => f)),
    );
  }
}
