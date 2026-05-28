import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_staff/features/broker/leads/data/dtos/broker_lead_dtos.dart';
import 'package:mobile_staff/features/broker/leads/data/mappers/broker_lead_mapper.dart';
import 'package:mobile_staff/features/broker/leads/data/datasources/broker_leads_remote_data_source.dart';
import 'package:mobile_staff/features/broker/leads/data/repositories/broker_leads_repository_impl.dart';
import 'package:mobile_staff/features/broker/leads/domain/entities/broker_lead.dart';
import 'package:mobile_staff/features/broker/leads/domain/repositories/broker_leads_repository.dart';
import 'package:mobile_staff/features/broker/leads/domain/usecases/broker_lead_use_cases.dart';
import 'package:mobile_staff/features/broker/leads/presentation/cubit/broker_leads_cubit.dart';
import 'package:mobile_staff/features/broker/leads/presentation/cubit/create_broker_lead_cubit.dart';

class _FakeRemote implements BrokerLeadsRemoteDataSource {
  _FakeRemote({this.rows = const [], this.error});
  final List<BrokerLeadDto> rows;
  final DioException? error;
  NewBrokerLead? created;

  @override
  Future<List<BrokerLeadDto>> list(BrokerLeadsQuery query) async {
    if (error != null) throw error!;
    return rows;
  }

  @override
  Future<BrokerLeadDetailDto> getOne(String id) async => throw UnimplementedError();

  @override
  Future<BrokerLeadDto> create(NewBrokerLead input) async {
    created = input;
    return rows.isNotEmpty ? rows.first : BrokerLeadDto.fromJson(_row());
  }
}

class _FakeRepo implements BrokerLeadsRepository {
  _FakeRepo({this.leads, this.createResult});
  final Result<List<BrokerLead>>? leads;
  final Result<BrokerLead>? createResult;
  int createCalls = 0;

  @override
  Future<Result<List<BrokerLead>>> getLeads(BrokerLeadsQuery q) async => leads!;
  @override
  Future<Result<BrokerLeadDetail>> getLead(String id) async => throw UnimplementedError();
  @override
  Future<Result<BrokerLead>> createLead(NewBrokerLead input) async {
    createCalls++;
    return createResult ?? Ok(BrokerLeadDto.fromJson(_row()).toEntity());
  }
}

Map<String, dynamic> _row({String approval = 'PENDING'}) => {
      'id': 'l1',
      'stage': 'NEW',
      'brokerApprovalStatus': approval,
      'client': {'fullName': 'Mona', 'phone': '+201'},
      'projectInterest': {'name': {'en': 'Project'}},
    };

void main() {
  group('BrokerLeadDto → entity', () {
    test('maps client + approval + stage + project', () {
      final l = BrokerLeadDto.fromJson(_row(approval: 'APPROVED')).toEntity();
      expect(l.fullName, 'Mona');
      expect(l.phone, '+201');
      expect(l.approvalStatus, 'APPROVED');
      expect(l.stage, 'NEW');
      expect(l.projectName, 'Project');
    });

    test('detail merges notes + activities newest-first', () {
      final d = BrokerLeadDetailDto.fromJson({
        ..._row(),
        'unitInterest': {'code': 'A-1'},
        'notes': [{'id': 'n1', 'body': 'Note', 'createdAt': '2026-06-01T00:00:00.000Z', 'sales': {'fullName': 'Rep'}}],
        'activities': [{'id': 'a1', 'type': 'created', 'createdAt': '2026-06-02T00:00:00.000Z'}],
      }).toEntity();
      expect(d.unitCode, 'A-1');
      expect(d.timeline.first.id, 'a1');
      expect(d.timeline.last.isNote, isTrue);
    });
  });

  group('BrokerLeadsRepositoryImpl', () {
    test('403 → forbidden', () async {
      final repo = BrokerLeadsRepositoryImpl(_FakeRemote(
        error: DioException(
          requestOptions: RequestOptions(path: '/portal/leads'),
          type: DioExceptionType.badResponse,
          response: Response(requestOptions: RequestOptions(path: '/x'), statusCode: 403),
        ),
      ));
      final r = await repo.getLeads(const BrokerLeadsQuery());
      expect(r.failureOrNull?.type, FailureType.forbidden);
    });

    test('create passes payload through', () async {
      final remote = _FakeRemote(rows: [BrokerLeadDto.fromJson(_row())]);
      final repo = BrokerLeadsRepositoryImpl(remote);
      await repo.createLead(const NewBrokerLead(fullName: 'Ali', phone: '+2010', projectInterestId: 'p1'));
      expect(remote.created?.fullName, 'Ali');
      expect(remote.created?.projectInterestId, 'p1');
    });
  });

  group('BrokerLeadsCubit', () {
    test('empty → empty', () async {
      final cubit = BrokerLeadsCubit(GetBrokerLeads(_FakeRepo(leads: const Ok([]))));
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('setApprovalStatus filters + reloads', () async {
      final cubit = BrokerLeadsCubit(GetBrokerLeads(_FakeRepo(leads: Ok([
        BrokerLeadDto.fromJson(_row(approval: 'APPROVED')).toEntity(),
      ]))));
      await cubit.setApprovalStatus('APPROVED');
      expect(cubit.state.approvalStatus, 'APPROVED');
      expect(cubit.state.status, DataStatus.success);
    });
  });

  group('CreateBrokerLeadCubit', () {
    test('invalid submit shows validation, no backend call', () async {
      final repo = _FakeRepo();
      final cubit = CreateBrokerLeadCubit(CreateBrokerLead(repo));
      await cubit.submit();
      expect(cubit.state.showValidation, isTrue);
      expect(repo.createCalls, 0);
    });

    test('valid submit creates + marks submitted', () async {
      final repo = _FakeRepo();
      final cubit = CreateBrokerLeadCubit(CreateBrokerLead(repo), projectInterestId: 'p1');
      cubit.setFullName('Mona');
      cubit.setPhone('+201000');
      await cubit.submit();
      expect(repo.createCalls, 1);
      expect(cubit.state.submitted, isTrue);
    });

    test('submit failure surfaces without submitted', () async {
      final repo = _FakeRepo(createResult: Result.err(AppFailure(type: FailureType.validation)));
      final cubit = CreateBrokerLeadCubit(CreateBrokerLead(repo));
      cubit.setFullName('Mona');
      cubit.setPhone('+201000');
      await cubit.submit();
      expect(cubit.state.submitted, isFalse);
      expect(cubit.state.submitFailure?.type, FailureType.validation);
    });
  });
}
