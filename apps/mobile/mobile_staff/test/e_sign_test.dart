import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/e_sign/data/signature_requests_repository_impl.dart';
import 'package:mobile_staff/features/e_sign/domain/signature_request.dart';
import 'package:mobile_staff/features/e_sign/presentation/signature_cubit.dart';
import 'package:mobile_staff/features/e_sign/presentation/signature_section.dart';

/// P5 in the staff app: send a booking form to the customer to sign online.

/// A 1×1 PNG.
const _png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.body);
  final Object body;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, _, _) async {
    requests.add(options);
    return ResponseBody.fromString(jsonEncode(body), 200, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });
  }

  @override
  void close({bool force = false}) {}
}

class _Repo implements SignatureRequestsRepository {
  _Repo([this.items = const []]);
  List<SignatureRequest> items;
  final calls = <String>[];
  AppFailure? refuse;

  @override
  Future<Result<List<SignatureRequest>>> list(String reservationId) async => Ok(items);

  @override
  Future<Result<SentSignatureRequest>> send(String reservationId, {required String locale}) async {
    calls.add('send:$reservationId:$locale');
    if (refuse != null) return Err(refuse!);
    const r = SignatureRequest(id: 'n1', state: 'PENDING', phone: '+20 ••• ••• 4567');
    items = [r, ...items.map((e) => e.isPending ? SignatureRequest(id: e.id, state: 'CANCELLED') : e)];
    return const Ok(SentSignatureRequest(request: r, url: 'https://acme.test/sign/tok123'));
  }

  @override
  Future<Result<void>> cancel(String requestId) async {
    calls.add('cancel:$requestId');
    items = [for (final e in items) e.id == requestId ? SignatureRequest(id: e.id, state: 'CANCELLED') : e];
    return const Ok(null);
  }
}

Future<void> _pump(WidgetTester t, _Repo repo, {String status = 'APPROVED'}) async {
  await t.pumpWidget(RepositoryProvider<SignatureRequestsRepository>.value(
    value: repo,
    child: MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: SingleChildScrollView(
          child: SignatureSection(reservationId: 'r1', bookingStatus: status, customerName: 'منى'),
        ),
      ),
    ),
  ));
  await t.pump();
  await t.pump();
}

void main() {
  test('reads a request, its signature image and whether the booking changed since', () {
    final r = SignatureRequest.fromJson({
      'id': 's1',
      'state': 'SIGNED',
      'createdAt': '2026-10-30T10:00:00.000Z',
      'expiresAt': '2026-11-02T10:00:00.000Z',
      'phone': '+20 ••• ••• 4567',
      'signerName': 'Mona',
      'signedAt': '2026-10-30T11:00:00.000Z',
      'outdated': true,
      'signature': _png,
    });
    expect(r.isSigned, isTrue);
    expect(r.outdated, isTrue);
    expect(r.signatureBytes, isNotNull);
    expect(const SignatureRequest(id: 'x', state: 'SIGNED', signature: 'nope').signatureBytes, isNull);
    expect(bookingSignable('APPROVED'), isTrue);
    expect(bookingSignable('CONVERTED'), isFalse);
  });

  test('sends with the language only (the API lays out the form) and keeps the link', () async {
    final adapter = _Adapter({'id': 'n1', 'state': 'PENDING', 'url': 'https://acme.test/sign/tok'});
    final dio = Dio(BaseOptions(baseUrl: 'https://api.test'))..httpClientAdapter = adapter;
    final sent = (await SignatureRequestsRepositoryImpl(dio).send('r1', locale: 'en')).dataOrNull!;
    expect(sent.url, 'https://acme.test/sign/tok');
    expect(sent.request.isPending, isTrue);
    final req = adapter.requests.single;
    expect('${req.method} ${req.path}', 'POST /reservations/r1/signature-requests');
    expect(req.data, {'locale': 'en'});
  });

  test('the cubit: send, then cancel; a refusal says why', () async {
    final repo = _Repo();
    final cubit = SignatureCubit(repo, reservationId: 'r1');
    await cubit.load();
    expect(cubit.state.status, DataStatus.empty);
    await cubit.send(locale: 'ar');
    expect(cubit.state.sent?.url, 'https://acme.test/sign/tok123');
    expect(cubit.state.latest?.isPending, isTrue);
    await cubit.cancel('n1');
    expect(cubit.state.latest?.state, 'CANCELLED');
    expect(cubit.state.sent, isNull);
    expect(repo.calls, ['send:r1:ar', 'cancel:n1']);

    repo.refuse = AppFailure(type: FailureType.validation, validationMessages: const ['لا يوجد رقم هاتف للعميل']);
    await cubit.send(locale: 'ar');
    expect(cubit.state.actionFailure, isNotNull);
    expect(cubit.state.working, isFalse);
  });

  testWidgets('not sent yet: «إرسال للتوقيع» opens the link to share', (t) async {
    final repo = _Repo();
    await _pump(t, repo);
    expect(find.text('لم يُرسَل للتوقيع بعد'), findsOneWidget);
    await t.tap(find.byKey(const Key('signature-send')));
    await t.pump();
    await t.pump();
    await t.pump(const Duration(milliseconds: 400));
    expect(find.byKey(const Key('signature-link-sheet')), findsOneWidget);
    expect(find.text('https://acme.test/sign/tok123'), findsOneWidget);
    expect(repo.calls, ['send:r1:ar']);
  });

  testWidgets('waiting: cancel asks first', (t) async {
    final repo = _Repo([const SignatureRequest(id: 'p1', state: 'PENDING', phone: '+20 ••• ••• 4567')]);
    await _pump(t, repo);
    expect(find.text('بانتظار توقيع العميل'), findsOneWidget);
    await t.tap(find.byKey(const Key('signature-cancel')));
    await t.pump(const Duration(milliseconds: 300));
    await t.tap(find.widgetWithText(FilledButton, 'إلغاء الطلب'));
    await t.pump();
    await t.pump();
    expect(repo.calls, ['cancel:p1']);
    expect(find.text('أُلغي الطلب'), findsOneWidget);
  });

  testWidgets('signed on an older version: the warning and a new link', (t) async {
    final repo = _Repo([
      SignatureRequest(id: 's1', state: 'SIGNED', signerName: 'Mona', signedAt: DateTime(2026, 10, 30, 11), outdated: true, signature: _png),
    ]);
    await _pump(t, repo);
    expect(find.text('وقّع العميل'), findsOneWidget);
    expect(find.byKey(const Key('signature-outdated')), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);
    expect(find.text('إرسال رابط جديد'), findsOneWidget);
  });

  testWidgets('a booking that is over and was never sent shows nothing', (t) async {
    await _pump(t, _Repo(), status: 'CONVERTED');
    expect(find.byKey(const Key('signature-card')), findsNothing);
  });
}
