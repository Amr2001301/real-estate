import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_customer/features/documents/domain/entities/customer_document.dart';
import 'package:mobile_customer/features/documents/domain/repositories/documents_repository.dart';
import 'package:mobile_customer/features/documents/domain/usecases/get_document_download_link.dart';
import 'package:mobile_customer/features/documents/presentation/document_download_cubit.dart';
import 'package:mobile_customer/features/documents/presentation/widgets/document_tile.dart';

class _Repo implements DocumentsRepository {
  @override
  Future<Result<List<CustomerDocument>>> listForOwner(DocumentOwnerType t, String id) async => const Ok([]);
  @override
  Future<Result<DocumentDownloadLink>> getDownloadLink(String id) async =>
      Ok(DocumentDownloadLink(url: 'https://signed.example/$id'));
}

void main() {
  test('pictures are told apart from files', () {
    expect(const CustomerDocument(id: '1', title: 'a', mimeType: 'image/jpeg').isImage, isTrue);
    expect(const CustomerDocument(id: '1', title: 'a', fileName: 'plan.PNG').isImage, isTrue);
    expect(const CustomerDocument(id: '1', title: 'a', mimeType: 'image/heic').isImage, isFalse);
    expect(const CustomerDocument(id: '1', title: 'a', mimeType: 'application/pdf').isImage, isFalse);
  });

  testWidgets('a picture document shows the picture, a file stays a download row', (tester) async {
    final cubit = DocumentDownloadCubit(GetDocumentDownloadLink(_Repo()));
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: BlocProvider.value(
          value: cubit,
          child: const Scaffold(
            body: SingleChildScrollView(child: Column(
              children: [
                DocumentTile(document: CustomerDocument(id: 'img', title: 'Photo', mimeType: 'image/jpeg')),
                DocumentTile(document: CustomerDocument(id: 'pdf', title: 'Contract', mimeType: 'application/pdf')),
              ],
            )),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();
    expect(find.byKey(const Key('document-image-img')), findsOneWidget);
    expect(find.byKey(const Key('document-image-pdf')), findsNothing);
    expect(find.byIcon(Icons.picture_as_pdf_rounded), findsOneWidget);
  });
}
