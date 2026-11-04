import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/leads/data/dtos/lead_dtos.dart';
import 'package:mobile_staff/features/leads/data/mappers/lead_mapper.dart';
import 'package:mobile_staff/features/leads/domain/entities/lead.dart';
import 'package:mobile_staff/features/leads/domain/repositories/leads_repository.dart';
import 'package:mobile_staff/features/leads/domain/usecases/lead_use_cases.dart';
import 'package:mobile_staff/features/leads/presentation/cubit/follow_ups_cubit.dart';
import 'package:mobile_staff/features/leads/presentation/cubit/lead_detail_cubit.dart';
import 'package:mobile_staff/features/leads/presentation/follow_up_labels.dart';
import 'package:mobile_staff/features/leads/presentation/screens/log_activity_screen.dart';
import 'package:mobile_staff/features/notifications/presentation/notification_route.dart';

/// FU1 in the staff app: logging what happened with a lead (kind, call
/// result, next follow-up, replies) and the follow-up lists.

Paginated<T> _page<T>(List<T> data, {int page = 1, int totalPages = 1}) =>
    Paginated(data: data, meta: PageMeta(page: page, pageSize: 20, total: data.length, totalPages: totalPages));

FollowUp _fu(String id) => FollowUp(lead: Lead(id: id, fullName: 'Lead $id', stage: 'INTERESTED'));

class _Repo implements LeadsRepository {
  @override
  Future<Result<Map<String, int>>> getPipeline() async => const Ok({});
  @override
  Future<Result<int>> countUnassigned() async => const Ok(0);
  @override
  Future<Result<List<StaffOption>>> getSalesStaff() async => const Ok([]);
  @override
  Future<Result<String>> openContact(String id, String kind) async => const Ok('');

  _Repo({this.summary = const FollowUpSummary(), Map<FollowUpBucket, List<Paginated<FollowUp>>>? pages})
      : pages = pages ?? {};
  final FollowUpSummary summary;
  final Map<FollowUpBucket, List<Paginated<FollowUp>>> pages;
  final notes = <LeadNoteInput>[];
  final listCalls = <String>[];

  @override
  Future<Result<Paginated<FollowUp>>> getFollowUps(FollowUpBucket bucket, {int page = 1}) async {
    listCalls.add('${bucket.name}:$page');
    final list = pages[bucket] ?? const [];
    return Ok(page <= list.length ? list[page - 1] : _page(const []));
  }

  @override
  Future<Result<FollowUpSummary>> getFollowUpSummary() async => Ok(summary);
  @override
  Future<Result<void>> addNote(String id, LeadNoteInput input) async {
    notes.add(input);
    return const Ok(null);
  }

  @override
  Future<Result<LeadDetail>> getLead(String id) async =>
      const Ok(LeadDetail(lead: Lead(id: 'l1', fullName: 'Mona', stage: 'NEW'), timeline: []));
  @override
  Future<Result<Paginated<Lead>>> getLeads(LeadsQuery query) async => Ok(_page(const []));
  @override
  Future<Result<void>> updateStage(String id, String stage, {String? reason, String? lostReasonId, String? lostNote}) async =>
      const Ok(null);
  @override
  Future<Result<List<LostReason>>> getLostReasons() async => const Ok([]);
  @override
  Future<Result<Lead>> createLead(NewLead input) async => throw UnimplementedError();
  @override
  Future<Result<List<LeadSource>>> getSources() async => const Ok([]);
  @override
  Future<Result<List<ClientSearchResult>>> searchClients(String q) async => const Ok([]);
}

LeadDetailCubit _detailCubit(_Repo repo) => LeadDetailCubit(
      GetLeadDetail(repo),
      UpdateLeadStage(repo),
      AddLeadNote(repo),
      leadId: 'l1',
      getLostReasons: GetLostReasons(repo),
    );

void main() {
  group('LeadNoteInput → request body', () {
    test('a call: its result and the next follow-up (UTC), type and note', () {
      final at = DateTime.utc(2026, 11, 2, 8);
      final json = LeadNoteInput(
        body: 'هيفكر ويرد',
        kind: 'CALL',
        callResult: 'ANSWERED',
        nextChange: NextActionChange.set,
        nextActionAt: at,
        nextActionType: 'WHATSAPP',
        nextActionNote: '  ابعتله العرض  ',
      ).toJson();
      expect(json, {
        'body': 'هيفكر ويرد',
        'kind': 'CALL',
        'callResult': 'ANSWERED',
        'nextActionAt': '2026-11-02T08:00:00.000Z',
        'nextActionType': 'WHATSAPP',
        'nextActionNote': 'ابعتله العرض',
      });
    });

    test('keeping the follow-up leaves it out; clearing sends null; a result only with a call', () {
      final keep = const LeadNoteInput(body: 'x', kind: 'MEETING', callResult: 'BUSY').toJson();
      expect(keep.containsKey('nextActionAt'), isFalse);
      expect(keep.containsKey('callResult'), isFalse);
      final clear = const LeadNoteInput(body: 'x', nextChange: NextActionChange.clear).toJson();
      expect(clear.containsKey('nextActionAt'), isTrue);
      expect(clear['nextActionAt'], isNull);
    });

    test('a reply is text only', () {
      expect(const LeadNoteInput.reply(parentId: 'n1', body: 'تمام').toJson(), {'body': 'تمام', 'parentId': 'n1'});
    });
  });

  group('lead detail: the logged activities and the next follow-up', () {
    test('kind, call result, replies and the lead\'s next action are read', () {
      final detail = LeadDetailDto.fromJson({
        'id': 'l1',
        'stage': 'INTERESTED',
        'fullName': 'Mona',
        'nextActionAt': '2026-11-03T08:00:00.000Z',
        'nextActionType': 'CALL',
        'nextActionNote': 'العرض النهائي',
        'notes': [
          {
            'id': 'n1',
            'body': 'رد واتفقنا على زيارة',
            'kind': 'CALL',
            'callResult': 'ANSWERED',
            'nextActionAt': '2026-11-03T08:00:00.000Z',
            'createdAt': '2026-11-01T08:00:00.000Z',
            'sales': {'fullName': 'Rep'},
            'replies': [
              {'id': 'r1', 'body': 'برافو', 'createdAt': '2026-11-01T09:00:00.000Z', 'sales': {'fullName': 'Manager'}},
            ],
          },
        ],
      }).toEntity();
      expect(detail.lead.nextActionAt, DateTime.utc(2026, 11, 3, 8).toLocal());
      expect(detail.lead.nextActionType, 'CALL');
      expect(detail.lead.nextActionNote, 'العرض النهائي');
      final note = detail.timeline.single;
      expect(note.kind, 'CALL');
      expect(note.callResult, 'ANSWERED');
      expect(note.nextActionAt, isNotNull);
      expect(note.replies.single.body, 'برافو');
      expect(note.replies.single.authorName, 'Manager');
    });

    test('an old note without a kind reads as a plain note', () {
      final dto = LeadNoteDto.fromJson({'id': 'n1', 'body': 'x'});
      expect(dto.kind, 'NOTE');
      expect(dto.replies, isEmpty);
    });

    test('a follow-up row carries the lead and its last activity', () {
      final fu = FollowUpRowDto.fromJson({
        'id': 'l9',
        'fullName': 'Ali',
        'stage': 'NEGOTIATION',
        'phone': '+201000',
        'nextActionAt': '2026-11-01T07:00:00.000Z',
        'nextActionType': 'WHATSAPP',
        'assignedSales': {'fullName': 'Rep'},
        'lastActivity': {'kind': 'CALL', 'callResult': 'NO_ANSWER', 'body': 'لم يرد', 'createdAt': '2026-10-31T10:00:00.000Z'},
      }).toEntity();
      expect(fu.lead.id, 'l9');
      expect(fu.lead.nextActionType, 'WHATSAPP');
      expect(fu.lead.assignedSalesName, 'Rep');
      expect(fu.lastKind, 'CALL');
      expect(fu.lastCallResult, 'NO_ANSWER');
      expect(fu.lastAt, isNotNull);
    });
  });

  group('FollowUpsCubit', () {
    test('opens on today when nothing is overdue, with the counts', () async {
      final repo = _Repo(
        summary: const FollowUpSummary(overdue: 0, today: 2, upcoming: 5),
        pages: {FollowUpBucket.today: [_page([_fu('a'), _fu('b')])]},
      );
      final cubit = FollowUpsCubit(GetFollowUps(repo), GetFollowUpSummary(repo));
      await cubit.load();
      expect(cubit.state.bucket, FollowUpBucket.today);
      expect(cubit.state.summary?.upcoming, 5);
      expect(cubit.state.items.map((f) => f.lead.id), ['a', 'b']);
      expect(cubit.state.status, DataStatus.success);
    });

    test('opens on overdue when something is late; switches lists; pages', () async {
      final repo = _Repo(
        summary: const FollowUpSummary(overdue: 21, today: 1),
        pages: {
          FollowUpBucket.overdue: [
            _page([_fu('o1')], totalPages: 2),
            _page([_fu('o2')], page: 2, totalPages: 2),
          ],
        },
      );
      final cubit = FollowUpsCubit(GetFollowUps(repo), GetFollowUpSummary(repo));
      await cubit.load();
      expect(cubit.state.bucket, FollowUpBucket.overdue);
      expect(cubit.state.hasMore, isTrue);
      await cubit.loadMore();
      expect(cubit.state.items.map((f) => f.lead.id), ['o1', 'o2']);
      expect(cubit.state.hasMore, isFalse);

      await cubit.select(FollowUpBucket.upcoming);
      expect(cubit.state.bucket, FollowUpBucket.upcoming);
      expect(cubit.state.status, DataStatus.empty);
      expect(repo.listCalls, ['overdue:1', 'overdue:2', 'upcoming:1']);
    });
  });

  group('LogActivityScreen', () {
    // A fixed "now": Sunday 1 Nov 2026, 13:00.
    DateTime now() => DateTime(2026, 11, 1, 13);

    Widget host(LeadDetailCubit cubit, {DateTime? currentNext}) => MaterialApp(
          theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
          locale: const Locale('ar'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: LogActivityScreen(cubit: cubit, leadName: 'Mona', currentNext: currentNext, now: now),
        );

    // The form is a scrolling list: bring a control into view before tapping.
    Future<void> reveal(WidgetTester tester, Finder f) async {
      if (f.evaluate().isEmpty) {
        // Back to the top, then down until it is built.
        await tester.drag(find.byType(Scrollable).first, const Offset(0, 4000));
        await tester.pumpAndSettle();
        if (f.evaluate().isEmpty) {
          await tester.scrollUntilVisible(f, 200, scrollable: find.byType(Scrollable).first);
        }
      }
      await tester.ensureVisible(f);
      await tester.pumpAndSettle();
    }

    Future<void> tapKey(WidgetTester tester, String key) async {
      final f = find.byKey(ValueKey(key));
      await reveal(tester, f);
      await tester.tap(f);
      await tester.pumpAndSettle();
    }

    // Saving shows a spinner until the screen closes (it has no route to close
    // here), so wait a moment rather than for every animation to end.
    Future<void> save(WidgetTester tester) async {
      final f = find.byKey(const ValueKey('activity-save'));
      await reveal(tester, f);
      await tester.tap(f);
      await tester.pump(const Duration(milliseconds: 100));
    }

    testWidgets('a call with its result and a follow-up tomorrow at 10', (tester) async {
      final repo = _Repo();
      await tester.pumpWidget(host(_detailCubit(repo)));
      await tester.pumpAndSettle();

      // Nothing is saved without saying what happened.
      await tapKey(tester, 'activity-save');
      expect(repo.notes, isEmpty);

      await tapKey(tester, 'result-NO_ANSWER');
      await reveal(tester, find.byKey(const Key('activity-body')));
      await tester.enterText(find.byKey(const Key('activity-body')), 'مردّش، هكلمه بكرة');
      await tester.pumpAndSettle();
      // "Set a time" starts on tomorrow at 10.
      await tapKey(tester, 'next-set');
      expect(find.byKey(const Key('next-when')), findsOneWidget);
      await save(tester);

      final note = repo.notes.single;
      expect(note.kind, 'CALL');
      expect(note.callResult, 'NO_ANSWER');
      expect(note.body, 'مردّش، هكلمه بكرة');
      expect(note.nextChange, NextActionChange.set);
      expect(note.nextActionAt, DateTime(2026, 11, 2, 10));
      expect(note.nextActionType, 'CALL');
    });

    testWidgets('a meeting has no call result; its follow-up type follows it', (tester) async {
      final repo = _Repo();
      await tester.pumpWidget(host(_detailCubit(repo)));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('result-ANSWERED')), findsOneWidget);
      await tapKey(tester, 'kind-MEETING');
      expect(find.byKey(const ValueKey('result-ANSWERED')), findsNothing);

      await reveal(tester, find.byKey(const Key('activity-body')));
      await tester.enterText(find.byKey(const Key('activity-body')), 'قابلته في الموقع');
      await tester.pumpAndSettle();
      await tapKey(tester, 'next-set');
      await tapKey(tester, 'next-week');
      await save(tester);
      final note = repo.notes.single;
      expect(note.kind, 'MEETING');
      expect(note.callResult, isNull);
      expect(note.nextActionType, 'MEETING');
      expect(note.nextActionAt, DateTime(2026, 11, 8, 10));
    });

    testWidgets('with a follow-up set, keeping it is the default', (tester) async {
      final repo = _Repo();
      await tester.pumpWidget(host(_detailCubit(repo), currentNext: DateTime(2026, 11, 3, 10)));
      await tester.pumpAndSettle();
      await reveal(tester, find.byKey(const Key('activity-body')));
      await tester.enterText(find.byKey(const Key('activity-body')), 'ملاحظة');
      await tester.pumpAndSettle();
      await save(tester);
      expect(repo.notes.single.nextChange, NextActionChange.keep);
    });

    testWidgets('with a follow-up set, "no follow-up" clears it', (tester) async {
      final repo = _Repo();
      await tester.pumpWidget(host(_detailCubit(repo), currentNext: DateTime(2026, 11, 3, 10)));
      await tester.pumpAndSettle();
      await reveal(tester, find.byKey(const Key('activity-body')));
      await tester.enterText(find.byKey(const Key('activity-body')), 'خلاص اشترى من مكان تاني');
      await tester.pumpAndSettle();
      await tapKey(tester, 'next-none');
      await save(tester);
      expect(repo.notes.single.nextChange, NextActionChange.clear);
      expect(repo.notes.single.toJson()['nextActionAt'], isNull);
    });
  });

  test('a reply goes under its note as text only', () async {
    final repo = _Repo();
    final ok = await _detailCubit(repo).reply('n1', '  تمام  ');
    expect(ok, isTrue);
    expect(repo.notes.single.toJson(), {'body': 'تمام', 'parentId': 'n1'});
  });

  group('follow-up words', () {
    testWidgets('today / tomorrow / a date, on a 12-hour clock', (tester) async {
      late AppLocalizations l10n;
      await tester.pumpWidget(MaterialApp(
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(builder: (context) {
          l10n = context.l10n;
          return const SizedBox();
        }),
      ));
      final now = DateTime(2026, 11, 1, 9);
      expect(followUpWhen(DateTime(2026, 11, 1, 15, 5), l10n, 'ar', now: now), 'اليوم 3:05 م');
      expect(followUpWhen(DateTime(2026, 11, 2, 10), l10n, 'ar', now: now), 'غدًا 10:00 ص');
      expect(clockTime(DateTime(2026, 1, 1, 0, 30), 'en'), '12:30 AM');
      expect(callResultLabel(l10n, 'NO_ANSWER'), 'لم يرد');
      expect(noteKindLabel(l10n, 'WHATSAPP'), 'واتساب');
    });
  });

  test('the morning follow-up list opens «المتابعات»; a lead reminder opens the lead', () {
    expect(staffNotificationRoute('follow_up_daily', {'entityType': 'follow_ups', 'today': 2}), '/follow-ups');
    expect(staffNotificationRoute('follow_up_team_daily', {'entityType': 'follow_ups'}), '/follow-ups');
    expect(
      staffNotificationRoute('follow_up_overdue', {'entityType': 'lead', 'entityId': 'l1'}),
      '/leads/l1',
    );
  });
}
