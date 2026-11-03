import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/contracts/data/dtos/contract_statement_dto.dart';
import 'package:mobile_customer/features/contracts/domain/entities/contract.dart';
import 'package:mobile_customer/features/contracts/domain/entities/contract_statement.dart';
import 'package:mobile_customer/features/contracts/domain/repositories/contracts_repository.dart';
import 'package:mobile_customer/features/contracts/presentation/contract_statement_screen.dart';

/// ST1 — the customer's statement of account (كشف حساب).

Map<String, dynamic> _json() => {
      'asOf': '2026-11-02',
      'lines': [
        {'date': '2026-10-01', 'kind': 'CONTRACT', 'rowType': null, 'debit': '1000000.00', 'credit': '0.00', 'balance': '1000000.00'},
        {
          'date': '2026-10-05',
          'kind': 'PAYMENT',
          'rowType': 'DOWN_PAYMENT',
          'rowDueDate': '2026-10-01',
          'method': 'CASH',
          'debit': '0.00',
          'credit': '100000.00',
          'balance': '900000.00',
        },
        {
          'date': '2026-10-20',
          'kind': 'REVERSAL',
          'rowType': 'INSTALLMENT',
          'method': 'CHEQUE',
          'debit': '90000.00',
          'credit': '0.00',
          'balance': '990000.00',
          'reason': 'شيك مرتد',
        },
      ],
      'totals': {
        'contractValue': '1000000.00',
        'fees': '0.00',
        'paid': '100000.00',
        'balance': '900000.00',
        'overdue': '90000.00',
        'dueToday': '0.00',
        'upcoming': '810000.00',
        'awaiting': '50000.00',
      },
      'awaiting': [
        {'date': '2026-11-01', 'amount': '50000.00', 'state': 'PENDING_REVIEW', 'rowType': 'INSTALLMENT'},
      ],
    };

class _Repo implements ContractsRepository {
  @override
  Future<Result<List<Contract>>> getMyContracts() async => const Ok([]);
  @override
  Future<Result<ContractStatement>> getStatement(String contractId) async => Ok(contractStatementFromJson(_json()));
}

void main() {
  test('parses money strings, dates, lines and the awaiting list', () {
    final s = contractStatementFromJson(_json());
    expect(s.balance, 900000);
    expect(s.overdue, 90000);
    expect(s.awaiting, 50000);
    expect(s.awaitingCount, 1);
    expect(s.lines, hasLength(3));
    expect(s.lines[1].rowDueDate, DateTime(2026, 10, 1));
    expect(s.lines[2].reason, 'شيك مرتد');
  });

  testWidgets('shows the balance, the figures and every movement in words', (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: RepositoryProvider<ContractsRepository>.value(
        value: _Repo(),
        child: const ContractStatementScreen(contractId: 'c1', contractNumber: 'CT-1'),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('كشف الحساب'), findsOneWidget);
    expect(find.text('المتبقي على العقد'), findsOneWidget);
    expect(find.text('متأخر'), findsOneWidget);
    expect(find.text('بانتظار التأكيد'), findsOneWidget);
    expect(find.text('مستحق اليوم'), findsNothing); // zero figures are hidden
    await tester.scrollUntilVisible(find.text('قيمة العقد'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('قيمة العقد'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('سداد الدفعة المقدمة — نقدًا'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('سداد الدفعة المقدمة — نقدًا'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('عكس سداد قسط'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.textContaining('السبب: شيك مرتد'), findsOneWidget);
  });
}
