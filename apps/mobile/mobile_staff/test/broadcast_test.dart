import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/notifications/view/broadcast_data.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter({this.recipients = 12, this.pushEnabled = true});
  final int recipients;
  final bool pushEnabled;
  final calls = <String>[];
  Map<String, dynamic>? lastBody;

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<List<int>>? s, Future<void>? c) async {
    calls.add('${o.method} ${o.path}');
    if (o.method == 'POST') lastBody = o.data as Map<String, dynamic>?;
    final body = o.path.endsWith('/preview')
        ? jsonEncode({'recipientCount': recipients, 'pushEnabled': pushEnabled, 'estimatedDeviceCount': 8, 'usersWithoutDevices': 4})
        : jsonEncode({'broadcastId': 'b', 'recipientCount': recipients, 'notificationRecordsCreated': recipients, 'failed': 0, 'pushSent': 8, 'pushFailed': 0, 'noDeviceTokens': 4});
    return ResponseBody.fromString(body, 200, headers: {Headers.contentTypeHeader: ['application/json']});
  }

  @override
  void close({bool force = false}) {}
}

const _text = BroadcastContent(titleAr: 'عنوان', titleEn: 'Title', bodyAr: 'نص', bodyEn: 'Body');

BroadcastCubit _cubit(_Adapter a) => BroadcastCubit(BroadcastRepository(Dio()..httpClientAdapter = a));

void main() {
  test('the audience is sent in the API shape', () {
    expect(const BroadcastAudience(target: BroadcastTarget.role, role: 'BROKER', channel: BroadcastChannel.both).toJson(), {'target': 'ROLE', 'targetRole': 'BROKER', 'channel': 'IN_APP_AND_PUSH'});
    expect(const BroadcastAudience(target: BroadcastTarget.user, userId: 'u1').toJson(), {'target': 'USER', 'targetUserId': 'u1', 'channel': 'IN_APP'});
  });

  test('both languages are required', () {
    expect(const BroadcastContent(titleAr: 'a', titleEn: 'b', bodyAr: 'c').complete, isFalse);
    expect(_text.complete, isTrue);
    expect(const BroadcastContent(titleAr: 'a', titleEn: 'b', bodyAr: 'c', bodyEn: 'd', entityType: 'contract').complete, isFalse);
  });

  test('a group send needs an estimate and a confirmation', () async {
    final a = _Adapter();
    final c = _cubit(a);
    c.setContent(_text);
    expect(c.state.canSend, isFalse);
    await c.estimate();
    expect(c.state.preview?.recipients, 12);
    expect(c.state.canSend, isFalse);
    c.setConfirmed(true);
    expect(c.state.canSend, isTrue);
    // Changing the audience clears both.
    c.setAudience(const BroadcastAudience(target: BroadcastTarget.allBrokers));
    expect(c.state.preview, isNull);
    expect(c.state.confirmed, isFalse);
  });

  test('a single user in the app needs neither', () {
    final c = _cubit(_Adapter());
    c.setContent(_text);
    c.setAudience(const BroadcastAudience(target: BroadcastTarget.user, userId: 'u1', userName: 'x'));
    expect(c.state.canSend, isTrue);
    c.setAudience(const BroadcastAudience(target: BroadcastTarget.user, userId: 'u1', channel: BroadcastChannel.push));
    expect(c.state.canSend, isFalse);
  });

  test('a push is blocked when the server has none', () async {
    final c = _cubit(_Adapter(pushEnabled: false));
    c.setContent(_text);
    c.setAudience(const BroadcastAudience(target: BroadcastTarget.user, userId: 'u1', channel: BroadcastChannel.both));
    await c.estimate();
    expect(c.state.pushBlocked, isTrue);
    expect(c.state.canSend, isFalse);
  });

  test('no recipients, no send', () async {
    final c = _cubit(_Adapter(recipients: 0));
    c.setContent(_text);
    await c.estimate();
    c.setConfirmed(true);
    expect(c.state.canSend, isFalse);
  });

  test('sending posts audience and text, shows the result and clears the text', () async {
    final a = _Adapter();
    final c = _cubit(a);
    c.setContent(const BroadcastContent(titleAr: 'عنوان', titleEn: 'Title', bodyAr: 'نص', bodyEn: 'Body', entityType: 'contract', entityId: 'c1'));
    c.setAudience(const BroadcastAudience(target: BroadcastTarget.role, role: 'SALES', channel: BroadcastChannel.both));
    await c.estimate();
    await c.send();
    expect(a.calls, contains('POST /notifications/broadcast'));
    expect(a.lastBody?['title_en'], 'Title');
    expect(a.lastBody?['entityType'], 'contract');
    expect(a.lastBody?['targetRole'], 'SALES');
    expect(c.state.result?.created, 12);
    expect(c.state.result?.outcome, 0);
    expect(c.state.content.titleAr, isEmpty);
    expect(c.state.audience.role, 'SALES');
  });

  test('the outcome tells all, some, none', () {
    expect(const BroadcastResult(created: 3).outcome, 0);
    expect(const BroadcastResult(created: 2, failed: 1).outcome, 1);
    expect(const BroadcastResult(failed: 3).outcome, 2);
    expect(const BroadcastResult(channel: BroadcastChannel.push, noDevice: 3).outcome, 2);
  });
}
