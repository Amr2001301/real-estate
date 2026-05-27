import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/documents/data/datasources/documents_remote_data_source.dart';
import 'package:mobile_customer/features/documents/data/dtos/document_dtos.dart';
import 'package:mobile_customer/features/documents/data/mappers/document_mapper.dart';
import 'package:mobile_customer/features/documents/data/repositories/documents_repository_impl.dart';
import 'package:mobile_customer/features/documents/domain/entities/customer_document.dart';
import 'package:mobile_customer/features/documents/domain/repositories/documents_repository.dart';
import 'package:mobile_customer/features/documents/domain/usecases/get_customer_documents.dart';
import 'package:mobile_customer/features/documents/domain/usecases/get_document_download_link.dart';
import 'package:mobile_customer/features/documents/presentation/document_download_cubit.dart';
import 'package:mobile_customer/features/documents/presentation/documents_list_cubit.dart';

/// Repository fake that counts download-link requests so we can prove the
/// cubit fetches a *fresh* signed link on every tap (expiry-safe), and can be
/// configured to fail (revoked access → 403/404).
class _FakeDocsRepo implements DocumentsRepository {
  _FakeDocsRepo({this.linkFailure, this.listResult = const Ok([])});
  final AppFailure? linkFailure;
  final Result<List<CustomerDocument>> listResult;
  int linkCalls = 0;

  @override
  Future<Result<List<CustomerDocument>>> listForOwner(
          DocumentOwnerType ownerType, String ownerId) async =>
      listResult;

  @override
  Future<Result<DocumentDownloadLink>> getDownloadLink(String documentId) async {
    linkCalls++;
    if (linkFailure != null) return Result.err(linkFailure!);
    // A successful fetch returns a fresh signed URL (cubit then launches it).
    return Ok(DocumentDownloadLink(url: 'https://signed.example/$documentId/$linkCalls'));
  }
}

class _ThrowingDocsDataSource implements DocumentsRemoteDataSource {
  _ThrowingDocsDataSource(this.status);
  final int status;

  DioException get _e => DioException(
        requestOptions: RequestOptions(path: '/me/documents'),
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: RequestOptions(path: '/me/documents'),
          statusCode: status,
        ),
      );

  @override
  Future<List<CustomerDocumentDto>> listForOwner(String ownerType, String ownerId) async =>
      throw _e;
  @override
  Future<DocumentDownloadLinkDto> downloadLink(String documentId) async => throw _e;
}

void main() {
  group('Document mappers', () {
    test('document dto → entity (isPdf by mime/extension)', () {
      final pdf = CustomerDocumentDto.fromJson({
        'id': 'doc1',
        'title': 'Contract',
        'fileName': 'contract.pdf',
        'mimeType': 'application/pdf',
        'createdAt': '2026-05-01T00:00:00.000Z',
      }).toEntity();
      expect(pdf.isPdf, isTrue);
      expect(pdf.title, 'Contract');
      expect(pdf.createdAt, isNotNull);
    });

    test('download-link dto → entity carries no permanent url field', () {
      final link = DocumentDownloadLinkDto.fromJson({
        'url': 'https://signed.example/x',
        'expiresIn': 300,
      }).toEntity();
      expect(link.url, 'https://signed.example/x');
      expect(link.expiresIn, 300);
    });
  });

  group('DocumentsRepositoryImpl error mapping (revoked access)', () {
    test('403 → Err(forbidden) friendly failure, never throws', () async {
      final repo = DocumentsRepositoryImpl(_ThrowingDocsDataSource(403));
      final result = await repo.getDownloadLink('doc1');
      expect(result.isErr, isTrue);
      expect(result.failureOrNull?.type, FailureType.forbidden);
    });

    test('404 → Err(notFound)', () async {
      final repo = DocumentsRepositoryImpl(_ThrowingDocsDataSource(404));
      final result = await repo.listForOwner(DocumentOwnerType.contract, 'c1');
      expect(result.failureOrNull?.type, FailureType.notFound);
    });
  });

  group('DocumentsListCubit', () {
    test('empty list → empty state', () async {
      final cubit = DocumentsListCubit(
        GetCustomerDocuments(_FakeDocsRepo()),
        ownerType: DocumentOwnerType.deposit,
        ownerId: 'd1',
      );
      await cubit.load();
      expect(cubit.state.status, DataStatus.empty);
    });

    test('non-empty → success', () async {
      final cubit = DocumentsListCubit(
        GetCustomerDocuments(_FakeDocsRepo(
          listResult: const Ok([CustomerDocument(id: 'doc1', title: 'Receipt')]),
        )),
        ownerType: DocumentOwnerType.deposit,
        ownerId: 'd1',
      );
      await cubit.load();
      expect(cubit.state.status, DataStatus.success);
    });
  });

  group('DocumentDownloadCubit (expiry-safe signed downloads)', () {
    test('403 on download → friendly failure, downloadingId cleared', () async {
      final repo = _FakeDocsRepo(linkFailure: AppFailure(type: FailureType.forbidden));
      final cubit = DocumentDownloadCubit(GetDocumentDownloadLink(repo));
      await cubit.open('doc1');
      expect(cubit.state.failure?.type, FailureType.forbidden);
      expect(cubit.state.downloadingId, isNull);
      expect(repo.linkCalls, 1);
    });

    test('re-fetches a fresh signed link on every open (no caching)', () async {
      final repo = _FakeDocsRepo(linkFailure: AppFailure(type: FailureType.notFound));
      final cubit = DocumentDownloadCubit(GetDocumentDownloadLink(repo));
      await cubit.open('doc1');
      await cubit.open('doc1');
      // Each completed tap mints a new link request → expiry is never reused.
      expect(repo.linkCalls, 2);
    });

    test('ignores a second tap while one is already in flight', () async {
      final repo = _FakeDocsRepo(linkFailure: AppFailure(type: FailureType.notFound));
      final cubit = DocumentDownloadCubit(GetDocumentDownloadLink(repo));
      final first = cubit.open('doc1');
      final second = cubit.open('doc1'); // dropped: one in flight
      await Future.wait([first, second]);
      expect(repo.linkCalls, 1);
    });
  });
}
