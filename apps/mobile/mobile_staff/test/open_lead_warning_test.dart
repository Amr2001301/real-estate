import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/leads/data/dtos/lead_dtos.dart';
import 'package:mobile_staff/features/leads/domain/entities/lead.dart';
import 'package:mobile_staff/features/leads/domain/repositories/leads_repository.dart';
import 'package:mobile_staff/features/leads/domain/usecases/lead_use_cases.dart';
import 'package:mobile_staff/features/leads/presentation/cubit/create_lead_cubit.dart';
import 'package:mobile_staff/features/leads/presentation/screens/open_lead_sheet.dart';

/// DUP2 — adding a lead for a customer who already has an open one.

AppFailure _openLeadFailure() {
  final req = RequestOptions(path: '/leads');
  return DioErrorMapper.map(DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(
      requestOptions: req,
      statusCode: 409,
      data: {
        'statusCode': 409,
        'message': 'This customer already has an open lead',
        'code': 'OPEN_LEAD_EXISTS',
        'leads': [
          {
            'id': 'l-open',
            'stage': 'NEGOTIATION',
            'createdAt': '2026-10-01T09:00:00.000Z',
            'assignedSales': {'id': 'u1', 'fullName': 'Rep One'},
          },
        ],
      },
    ),
  ));
}

class _Repo implements LeadsRepository {
  final created = <NewLead>[];

  @override
  Future<Result<Lead>> createLead(NewLead input) async {
    created.add(input);
    if (!input.allowDuplicate) return Err(_openLeadFailure());
    return const Ok(Lead(id: 'l-new', fullName: 'Mona', stage: 'NEW'));
  }

  @override
  Future<Result<List<LeadSource>>> getSources() async => const Ok([]);

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

void main() {
  test('the 409 names the open lead', () {
    final leads = openLeadsOf(_openLeadFailure());
    expect(leads, hasLength(1));
    expect(leads.single.id, 'l-open');
    expect(leads.single.stage, 'NEGOTIATION');
    expect(leads.single.ownerName, 'Rep One');
    expect(leads.single.createdAt, isNotNull);
  });

  test('any other failure names no lead', () {
    final other = AppFailure(type: FailureType.validation, code: 'SOMETHING_ELSE');
    expect(openLeadsOf(other), isEmpty);
  });

  test('refused once, then added anyway with the same details', () async {
    final repo = _Repo();
    final cubit = CreateLeadCubit(CreateLead(repo), repo);
    await cubit.submit(fullName: 'Mona', phone: '01000000000', notes: 'call back');

    expect(cubit.state.status, CreateLeadStatus.failure);
    expect(cubit.state.openLeads.single.id, 'l-open');

    await cubit.submitAnyway();
    expect(cubit.state.status, CreateLeadStatus.success);
    expect(cubit.state.openLeads, isEmpty);
    expect(repo.created, hasLength(2));
    final again = repo.created.last;
    expect(again.allowDuplicate, isTrue);
    expect(again.fullName, 'Mona');
    expect(again.phone, '01000000000');
    expect(again.notes, 'call back');
    await cubit.close();
  });

  testWidgets('the sheet shows the open lead and both choices', (tester) async {
    String? opened;
    var anyway = 0;
    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: OpenLeadSheet(
          leads: openLeadsOf(_openLeadFailure()),
          onOpen: (id) => opened = id,
          onAnyway: () => anyway++,
        ),
      ),
    ));

    expect(find.textContaining('Rep One'), findsOneWidget);
    await tester.tap(find.byType(TextButton));
    expect(opened, 'l-open');
    await tester.tap(find.byKey(const ValueKey('add-lead-anyway')));
    expect(anyway, 1);
  });
}
