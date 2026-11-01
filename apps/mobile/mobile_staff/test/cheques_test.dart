import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/cheques/data/cheques_repository_impl.dart';
import 'package:mobile_staff/features/cheques/domain/cheque.dart';
import 'package:mobile_staff/features/cheques/presentation/cheques_cubit.dart';
import 'package:mobile_staff/features/cheques/presentation/cheques_screen.dart';
import 'package:mobile_staff/features/leads/data/datasources/leads_remote_data_source.dart';
import 'package:mobile_staff/features/leads/domain/repositories/leads_repository.dart';

/// FG-01 in the staff app: the cheques list and one cheque (read-only), and
/// the lists reading the page count from the API's `meta`.

/// Answers every request with [body] and keeps the requests.
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

Dio _dio(_Adapter a) => Dio(BaseOptions(baseUrl: 'https://api.test'))..httpClientAdapter = a;

Map<String, dynamic> _row({String status = 'PENDING_CLEARANCE', String? due = '2026-11-01T00:00:00.000Z'}) => {
      'id': 'pi1',
      'type': 'CHEQUE',
      'status': status,
      'chequeNumber': '000123',
      'drawerBankName': 'CIB',
      'chequeDueDate': due,
      'deposits': [
        {
          'id': 'd1',
          'amount': '15000.00',
          'reviewStatus': 'PENDING_REVIEW',
          'installment': {'id': 'i1', 'dueDate': '2026-11-01T00:00:00.000Z', 'status': 'PENDING'},
          'contract': {'id': 'c1', 'contractNumber': 'CT-7', 'customer': {'id': 'u1', 'fullName': 'Mona'}},
        },
        {'id': 'd2', 'amount': '5000', 'reviewStatus': 'PENDING_REVIEW'},
      ],
    };

class _Repo implements ChequesRepository {
  _Repo(this.pages);
  final Map<String?, List<Paginated<Cheque>>> pages;
  final calls = <String>[];
  Cheque? detail;

  @override
  Future<Result<Paginated<Cheque>>> list({String? status, String? q, int page = 1}) async {
    calls.add('$status:$page');
    final list = pages[status] ?? const [];
    return Ok(page <= list.length
        ? list[page - 1]
        : Paginated(data: const [], meta: const PageMeta(page: 1, pageSize: 20, total: 0, totalPages: 1)));
  }

  @override
  Future<Result<Cheque>> get(String id) async => Ok(detail!);

  final actions = <String>[];
  AppFailure? refuse;

  @override
  Future<Result<void>> deposit(String id) async {
    if (refuse != null) return Err(refuse!);
    actions.add('deposit:$id');
    detail = Cheque(id: id, type: 'CHEQUE', status: 'DEPOSITED');
    return const Ok(null);
  }

  @override
  Future<Result<void>> clear(String id, {DateTime? clearingDate}) async {
    actions.add('clear:$id:${clearingDate == null ? '' : calendarDayOf(clearingDate)}');
    detail = Cheque(id: id, type: 'CHEQUE', status: 'CLEARED', clearingDate: clearingDate);
    return const Ok(null);
  }
}

Paginated<Cheque> _page(List<String> ids, {int page = 1, int pages = 1}) => Paginated(
      data: [for (final id in ids) Cheque(id: id, type: 'CHEQUE', status: 'PENDING_CLEARANCE')],
      meta: PageMeta(page: page, pageSize: 20, total: ids.length * pages, totalPages: pages),
    );

void main() {
  group('Cheque', () {
    test('a list row: number, bank, the payments\' total, the customer and contract', () {
      final c = Cheque.fromJson(_row());
      expect(c.number, '000123');
      expect(c.bank, 'CIB');
      expect(c.amount, 20000);
      expect(c.customer, 'Mona');
      expect(c.contractNumber, 'CT-7');
      expect(c.contractId, 'c1');
      expect(c.payments, hasLength(2));
      expect(c.payments.first.installmentStatus, 'PENDING');
    });

    test('a booking cheque names the reservation\'s client', () {
      final c = Cheque.fromJson({
        'id': 'pi2',
        'type': 'CHEQUE',
        'status': 'DEPOSITED',
        'deposits': [
          {'amount': '1000', 'reservation': {'id': 'r1', 'reservationNumber': 'R-9', 'client': {'fullName': 'Ali'}}},
        ],
      });
      expect(c.customer, 'Ali');
      expect(c.reservationNumber, 'R-9');
      expect(c.contractNumber, isNull);
    });

    test('due for deposit: still with the company on or after its date', () {
      final now = DateTime(2026, 11, 2);
      expect(Cheque.fromJson(_row()).dueForDeposit(now), isTrue);
      expect(Cheque.fromJson(_row(status: 'DEPOSITED')).dueForDeposit(now), isFalse);
      expect(Cheque.fromJson(_row(due: '2026-12-01T00:00:00.000Z')).dueForDeposit(now), isFalse);
    });

    test('the detail keeps the list row\'s customer and contract', () {
      final row = Cheque.fromJson(_row());
      final detail = Cheque.fromJson({
        'id': 'pi1',
        'type': 'CHEQUE',
        'status': 'CLEARED',
        'chequeNumber': '000123',
        'recordedBy': {'fullName': 'Treasurer'},
        'deposits': [
          {'amount': '15000', 'installment': {'dueDate': '2026-11-01T00:00:00.000Z', 'status': 'PAID'}},
        ],
      }).withListContext(row);
      expect(detail.status, 'CLEARED');
      expect(detail.customer, 'Mona');
      expect(detail.contractNumber, 'CT-7');
      expect(detail.recordedBy, 'Treasurer');
      expect(detail.amount, 15000);
    });
  });

  test('amounts read in Western digits and separators', () {
    expect(chequeMoney(150000, 'ar'), startsWith('150,000'));
  });

  test('the clearing date goes as a day; deposit and clear hit their endpoints', () async {
    final adapter = _Adapter({'id': 'pi1'});
    final repo = ChequesRepositoryImpl(_dio(adapter));
    await repo.deposit('pi1');
    await repo.clear('pi1', clearingDate: DateTime(2026, 10, 30, 15));
    expect(adapter.requests.map((r) => '${r.method} ${r.path}'), [
      'POST /payment-instruments/pi1/deposit',
      'POST /payment-instruments/pi1/clear',
    ]);
    expect(adapter.requests.last.data, {'clearingDate': '2026-10-30'});
  });

  group('ChequesRepositoryImpl', () {
    test('asks for cheques of one status and reads the page envelope', () async {
      final adapter = _Adapter({
        'data': [_row()],
        'meta': {'page': 1, 'pageSize': 20, 'total': 41, 'totalPages': 3},
      });
      final result = await ChequesRepositoryImpl(_dio(adapter)).list(status: 'DEPOSITED');
      final page = result.dataOrNull!;
      expect(page.data.single.id, 'pi1');
      expect(page.hasMore, isTrue);
      final q = adapter.requests.single.queryParameters;
      expect(q['type'], 'CHEQUE');
      expect(q['status'], 'DEPOSITED');
    });
  });

  test('the leads list reads its page count from `meta` (it used to stop at 20)', () async {
    final adapter = _Adapter({
      'data': [
        {'id': 'l1', 'stage': 'NEW', 'fullName': 'A'},
      ],
      'meta': {'page': 1, 'pageSize': 20, 'total': 45, 'totalPages': 3},
    });
    final page = await LeadsRemoteDataSourceImpl(_dio(adapter)).list(const LeadsQuery());
    expect(page.meta.totalPages, 3);
    expect(page.hasMore, isTrue);
  });

  group('ChequesCubit', () {
    test('opens on the cheques still with the company; switches status; pages', () async {
      final repo = _Repo({
        'PENDING_CLEARANCE': [_page(['a'], pages: 2), _page(['b'], page: 2, pages: 2)],
        'BOUNCED': [_page(['x'])],
      });
      final cubit = ChequesCubit(repo);
      await cubit.load();
      expect(cubit.state.filter, 'PENDING_CLEARANCE');
      expect(cubit.state.hasMore, isTrue);
      await cubit.loadMore();
      expect(cubit.state.items.map((c) => c.id), ['a', 'b']);
      await cubit.setFilter('BOUNCED');
      expect(cubit.state.items.map((c) => c.id), ['x']);
      await cubit.setFilter(null);
      expect(cubit.state.status, DataStatus.empty);
      expect(repo.calls, ['PENDING_CLEARANCE:1', 'PENDING_CLEARANCE:2', 'BOUNCED:1', 'null:1']);
    });

    test('the detail is read fresh, with the row\'s customer', () async {
      final repo = _Repo({})
        ..detail = const Cheque(id: 'pi1', type: 'CHEQUE', status: 'CLEARED');
      final cubit = ChequeDetailCubit(repo, id: 'pi1', row: Cheque.fromJson(_row()));
      await cubit.load();
      expect(cubit.state.cheque?.status, 'CLEARED');
      expect(cubit.state.cheque?.customer, 'Mona');
    });

    test('deposited, then cleared on a day: each step is recorded and the cheque read again', () async {
      final repo = _Repo({})..detail = const Cheque(id: 'pi1', type: 'CHEQUE', status: 'PENDING_CLEARANCE');
      final cubit = ChequeDetailCubit(repo, id: 'pi1', row: Cheque.fromJson(_row()));
      await cubit.load();
      expect(cubit.state.cheque!.canDeposit, isTrue);
      expect(cubit.state.cheque!.canClear, isFalse);

      await cubit.deposit();
      expect(cubit.state.cheque!.status, 'DEPOSITED');
      expect(cubit.state.cheque!.canClear, isTrue);
      expect(cubit.state.done, 'deposit');
      expect(cubit.state.cheque!.customer, 'Mona'); // still from the list row

      await cubit.clear(clearingDate: DateTime(2026, 10, 30));
      expect(cubit.state.cheque!.status, 'CLEARED');
      expect(cubit.state.done, 'clear');
      expect(repo.actions, ['deposit:pi1', 'clear:pi1:2026-10-30']);
    });

    test('a refused step says why and leaves the cheque as it was', () async {
      final repo = _Repo({})
        ..detail = const Cheque(id: 'pi1', type: 'CHEQUE', status: 'PENDING_CLEARANCE')
        ..refuse = AppFailure(type: FailureType.validation, technicalMessage: 'Invalid transition');
      final cubit = ChequeDetailCubit(repo, id: 'pi1');
      await cubit.load();
      await cubit.deposit();
      expect(cubit.state.actionFailure, isNotNull);
      expect(cubit.state.working, isFalse);
      expect(cubit.state.cheque!.status, 'PENDING_CLEARANCE');
    });
  });
}
