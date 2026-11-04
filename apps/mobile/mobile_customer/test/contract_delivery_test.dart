import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/contracts/data/dtos/contract_dto.dart';
import 'package:mobile_customer/features/contracts/data/mappers/contract_mapper.dart';
import 'package:mobile_customer/features/contracts/domain/entities/contract.dart';
import 'package:mobile_customer/features/contracts/domain/entities/contract_statement.dart';
import 'package:mobile_customer/features/contracts/domain/repositories/contracts_repository.dart';
import 'package:mobile_customer/features/contracts/presentation/contract_detail_screen.dart';
import 'package:mobile_customer/features/documents/domain/entities/customer_document.dart';
import 'package:mobile_customer/features/documents/domain/repositories/documents_repository.dart';
import 'package:mobile_customer/features/documents/domain/usecases/get_customer_documents.dart';
import 'package:mobile_customer/features/documents/presentation/documents_list_cubit.dart';
import 'package:mobile_customer/features/installments/domain/entities/installment.dart';
import 'package:mobile_customer/features/installments/domain/repositories/installments_repository.dart';
import 'package:mobile_customer/features/notifications/presentation/notification_route.dart';

/// F10 in the customer app — the handover date the contract promised and,
/// when it slipped, the one expected now.

class _NoDocs implements DocumentsRepository {
  @override
  Future<Result<List<CustomerDocument>>> listForOwner(DocumentOwnerType ownerType, String ownerId) async =>
      const Ok([]);

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

/// The money sections load on their own; here they find nothing.
class _NoStatement implements ContractsRepository {
  @override
  Future<Result<ContractStatement>> getStatement(String contractId) async => Err(AppFailure(type: FailureType.notFound));

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

class _NoInstallments implements InstallmentsRepository {
  @override
  Future<Result<List<Installment>>> getMyInstallments() async => const Ok([]);

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

Map<String, dynamic> _row({Map<String, dynamic> extra = const {}}) => {
      'id': 'c1',
      'contractNumber': 'C-1',
      'signedAt': '2026-01-10T00:00:00.000Z',
      'unit': {'code': 'A-1', 'type': '2BR'},
      ...extra,
    };

Future<void> _pump(WidgetTester tester, Contract contract) async {
  await tester.pumpWidget(MaterialApp(
    theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
    locale: const Locale('ar'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: MultiRepositoryProvider(
      providers: [
        RepositoryProvider<ContractsRepository>.value(value: _NoStatement()),
        RepositoryProvider<InstallmentsRepository>.value(value: _NoInstallments()),
      ],
      child: BlocProvider(
        create: (_) => DocumentsListCubit(
          GetCustomerDocuments(_NoDocs()),
          ownerType: DocumentOwnerType.contract,
          ownerId: contract.id,
        ),
        child: ContractDetailScreen(contract: contract),
      ),
    ),
  ));
  await tester.pump();
}

void main() {
  test('the dates and the delay come from the API', () {
    final c = ContractDto.fromJson(_row(extra: {
      'deliveryDate': '2027-06-30',
      'expectedDeliveryDate': '2027-12-31',
      'deliveryDelayDays': 184,
    })).toEntity();
    expect(c.deliveryDate, DateTime(2027, 6, 30));
    expect(c.expectedDeliveryDate, DateTime(2027, 12, 31));
    expect(c.deliveryDelayDays, 184);
  });

  test('an older API without them reads as no dates, on time', () {
    final c = ContractDto.fromJson(_row()).toEntity();
    expect(c.deliveryDate, isNull);
    expect(c.deliveryDelayDays, 0);
  });

  test('the delay and handover notices open the contract', () {
    expect(
      customerNotificationRoute('delivery_delayed_customer', {'entityType': 'contract', 'entityId': 'c1'}),
      '/account/contracts/c1',
    );
    // Sent before the notice carried entityType: its contractId still opens it.
    expect(customerNotificationRoute('delivery_delayed_customer', {'contractId': 'c1'}), '/account/contracts/c1');
    expect(customerNotificationRoute('unit_handed_over', {'contractId': 'c1'}), '/account/contracts/c1');
  });

  testWidgets('a late handover shows both dates and the days late', (tester) async {
    final c = ContractDto.fromJson(_row(extra: {
      'deliveryDate': '2027-06-30',
      'expectedDeliveryDate': '2027-12-31',
      'deliveryDelayDays': 184,
    })).toEntity();
    await _pump(tester, c);
    expect(find.byKey(const ValueKey('contract-delivery-promised')), findsOneWidget);
    expect(find.byKey(const ValueKey('contract-delivery-late')), findsOneWidget);
    expect(find.textContaining('184'), findsOneWidget);
  });

  testWidgets('on time: only the promised date; after the handover: neither', (tester) async {
    final onTime = ContractDto.fromJson(_row(extra: {
      'deliveryDate': '2027-06-30',
      'expectedDeliveryDate': '2027-06-30',
      'deliveryDelayDays': 0,
    })).toEntity();
    await _pump(tester, onTime);
    expect(find.byKey(const ValueKey('contract-delivery-promised')), findsOneWidget);
    expect(find.byKey(const ValueKey('contract-delivery-late')), findsNothing);

    final handed = ContractDto.fromJson(_row(extra: {
      'deliveryDate': '2027-06-30',
      'expectedDeliveryDate': '2027-12-31',
      'deliveryDelayDays': 184,
      'handover': {'handedOverAt': '2027-12-20T00:00:00.000Z'},
    })).toEntity();
    await _pump(tester, handed);
    expect(find.byKey(const ValueKey('contract-delivery-promised')), findsNothing);
    expect(find.byKey(const ValueKey('contract-delivery-late')), findsNothing);
  });
}
