import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/assistant/data/assistant_repository_impl.dart';
import 'package:mobile_staff/features/assistant/domain/assistant.dart';
import 'package:mobile_staff/features/assistant/presentation/answer_text.dart';
import 'package:mobile_staff/features/assistant/presentation/assistant_cubit.dart';
import 'package:mobile_staff/features/assistant/presentation/assistant_screen.dart';

/// AI2 in the staff app: the assistant chat.

class _Adapter implements HttpClientAdapter {
  _Adapter(this.body);
  final Map<String, dynamic> body;
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

class _Repo implements AssistantRepository {
  _Repo({this.state = const AiStatus(available: true)});
  AiStatus state;
  final asked = <(String, List<AiTurn>)>[];
  AppFailure? refuse;
  int? remaining = 10;

  @override
  Future<Result<AiStatus>> status() async => Ok(state);

  @override
  Future<Result<AiAnswer>> ask(String message, List<AiTurn> history) async {
    asked.add((message, history));
    if (refuse != null) return Err(refuse!);
    return Ok(AiAnswer(answer: 'answer to $message', remaining: remaining));
  }
}

void main() {
  group('AssistantRepositoryImpl', () {
    test('asks with the last 20 turns and reads the answer and what is left', () async {
      final adapter = _Adapter({
        'answer': 'Two customers',
        'usage': {'used': 3, 'quota': 100, 'remaining': 97},
      });
      final dio = Dio(BaseOptions(baseUrl: 'https://api.test'))..httpClientAdapter = adapter;
      final history = [for (var k = 0; k < 25; k++) AiTurn.user('q$k')];
      final a = (await AssistantRepositoryImpl(dio).ask('Who is late?', history)).dataOrNull!;
      expect(a.answer, 'Two customers');
      expect(a.remaining, 97);
      final req = adapter.requests.single;
      expect('${req.method} ${req.path}', 'POST /ai/ask');
      final sent = (req.data as Map)['history'] as List;
      expect(sent, hasLength(20));
      expect(sent.first, {'role': 'user', 'content': 'q5'});
      expect((req.data as Map)['message'], 'Who is late?');
    });
  });

  group('AssistantCubit', () {
    test('a question and its answer join the chat; the history goes along', () async {
      final repo = _Repo();
      final cubit = AssistantCubit(repo);
      await cubit.load();
      await cubit.ask('  first  ');
      await cubit.ask('second');
      expect(cubit.state.turns.map((t) => t.content), ['first', 'answer to first', 'second', 'answer to second']);
      expect(repo.asked.last.$2, hasLength(2));
      cubit.clear();
      expect(cubit.state.turns, isEmpty);
    });

    test('an unanswered question goes back to the box with why', () async {
      final repo = _Repo()
        ..refuse = AppFailure(type: FailureType.maintenance, statusCode: 503, code: 'AI_UNAVAILABLE');
      final cubit = AssistantCubit(repo);
      await cubit.ask('late?');
      expect(cubit.state.turns, isEmpty);
      expect(cubit.state.draft, 'late?');
      expect(cubit.state.error?.code, 'AI_UNAVAILABLE');
      expect(cubit.state.canAsk, isTrue);
    });

    test('used-up questions stop asking; too many is RATE', () async {
      final repo = _Repo()..refuse = AppFailure(type: FailureType.forbidden, statusCode: 403, code: 'AI_QUOTA_EXHAUSTED');
      final cubit = AssistantCubit(repo);
      await cubit.ask('x');
      expect(cubit.state.blockedReason, 'EXHAUSTED');
      expect(cubit.state.canAsk, isFalse);

      final rate = AssistantCubit(_Repo()..refuse = AppFailure(type: FailureType.unknown, statusCode: 429));
      await rate.ask('x');
      expect(rate.state.error?.code, 'RATE');
    });

    test('the last question of the package closes it', () async {
      final repo = _Repo()..remaining = 0;
      final cubit = AssistantCubit(repo);
      await cubit.ask('x');
      expect(cubit.state.turns, hasLength(2));
      expect(cubit.state.blockedReason, 'EXHAUSTED');
    });
  });

  group('parseAnswer', () {
    test('paragraphs, lists and tables', () {
      final blocks = parseAnswer('## Summary\nTwo **late** customers:\n\n- Mona\n- Ali\n\n| Name | Due |\n|---|---|\n| Mona | 1,000 |\n\n1. one\n2. two');
      expect(blocks[0], isA<AnswerParagraph>());
      expect((blocks[0] as AnswerParagraph).text, 'Summary\nTwo **late** customers:');
      expect((blocks[1] as AnswerList).items, ['Mona', 'Ali']);
      expect((blocks[1] as AnswerList).ordered, isFalse);
      final table = blocks[2] as AnswerTable;
      expect(table.head, ['Name', 'Due']);
      expect(table.rows, [
        ['Mona', '1,000'],
      ]);
      expect((blocks[3] as AnswerList).ordered, isTrue);
    });

    test('bold runs, an unclosed ** stays, Arabic digits read Western', () {
      const base = TextStyle();
      final spans = answerSpans('a **b** c', base);
      expect(spans.map((s) => s.text), ['a ', 'b', ' c']);
      expect(spans[1].style?.fontWeight, FontWeight.w700);
      expect(answerSpans('a **b', base).map((s) => s.text).join(), 'a **b');
      expect(latinAnswer('١٥٠٬٠٠٠'), '150,000');
    });
  });

  testWidgets('the screen: suggestions ask; used-up package shows a notice', (tester) async {
    final repo = _Repo();
    Future<void> pump(AssistantCubit cubit) => tester.pumpWidget(MaterialApp(
          theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
          locale: const Locale('ar'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: BlocProvider.value(key: ObjectKey(cubit), value: cubit, child: const AssistantScreen()),
        ));

    await pump(AssistantCubit(repo));
    await tester.pump();
    expect(find.byKey(const Key('assistant-unavailable')), findsNothing);
    await tester.tap(find.byKey(const Key('assistant-suggestion-0')));
    await tester.pump();
    await tester.pump();
    expect(repo.asked.single.$1, 'مين العملاء اللي عليهم أقساط متأخرة؟');
    expect(find.textContaining('answer to'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('assistant-input')), 'وحدات؟');
    await tester.pump();
    await tester.tap(find.byKey(const Key('assistant-send')));
    await tester.pump();
    await tester.pump();
    expect(repo.asked.last.$1, 'وحدات؟');

    final blocked = _Repo(state: const AiStatus(available: false, reason: 'EXHAUSTED'));
    await pump(AssistantCubit(blocked));
    await tester.pump();
    expect(find.byKey(const Key('assistant-unavailable')), findsOneWidget);
    await tester.tap(find.byKey(const Key('assistant-suggestion-0')));
    await tester.pump();
    expect(blocked.asked, isEmpty);
  });
}
