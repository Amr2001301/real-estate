import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/inquiries/inquiries_screen.dart';

class _Repo implements InquiriesRepository {
  final sets = <String>[];

  @override
  Future<Result<Paginated<InquiryRow>>> list({String? status, int page = 1}) async => Ok(Paginated(
        data: [
          InquiryRow.fromJson(const {
            'id': 'i1',
            'message': 'هل الوحدة متاحة بالتقسيط؟',
            'status': 'OPEN',
            'createdAt': '2026-11-04T09:00:00Z',
            'user': {'fullName': 'مها سعيد', 'phone': '01000000000', 'role': 'CUSTOMER'},
            'project': {'name': {'ar': 'مشروع النخيل', 'en': 'Palms'}},
            'unit': {'code': 'A-101'},
          }),
          InquiryRow.fromJson(const {'id': 'i2', 'message': 'سؤال عن الأسعار', 'status': 'CLOSED', 'lead': {'fullName': 'زائر', 'phone': null}}),
        ],
        meta: const PageMeta(page: 1, pageSize: 20, total: 2, totalPages: 1),
      ));

  @override
  Future<Result<InquiryCounts>> counts() async => const Ok(InquiryCounts(open: 1, closed: 1));

  @override
  Future<Result<void>> setStatus(String id, String status) async {
    sets.add('$id:$status');
    return const Ok(null);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Widget _app(Widget child) => MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    );

void main() {
  test('an inquiry reads its sender, kind and project from the API row', () {
    final r = InquiryRow.fromJson(const {
      'id': 'x',
      'message': 'm',
      'status': 'RESPONDED',
      'user': {'fullName': 'علي', 'role': 'CLIENT'},
      'project': {'name': 'مشروع'},
    });
    expect(r.kind, 'browser');
    expect(r.project?.ar, 'مشروع');
    expect(InquiryRow.fromJson(const {'id': 'y', 'message': 'm'}).kind, 'visitor');
  });

  testWidgets('the list shows the counts and cards; replying calls the API', (t) async {
    final repo = _Repo();
    await t.pumpWidget(_app(InquiriesScreen(repository: repo)));
    await t.pumpAndSettle();
    expect(find.text('استفسارات العملاء'), findsOneWidget);
    expect(find.text('مها سعيد'), findsOneWidget);
    expect(find.text('هل الوحدة متاحة بالتقسيط؟'), findsOneWidget);
    expect(find.byKey(const Key('inquiry-replied-i1')), findsOneWidget);
    expect(find.byKey(const Key('inquiry-close-i2')), findsNothing); // closed: nothing left to do
    await t.tap(find.byKey(const Key('inquiry-replied-i1')));
    await t.pumpAndSettle();
    expect(repo.sets, ['i1:RESPONDED']);
  });

  testWidgets('without the approve code there are no reply or close buttons', (t) async {
    await t.pumpWidget(_app(InquiriesScreen(repository: _Repo(), canAct: false)));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('inquiry-replied-i1')), findsNothing);
    expect(find.byKey(const Key('inquiry-call-i1')), findsOneWidget);
  });
}
