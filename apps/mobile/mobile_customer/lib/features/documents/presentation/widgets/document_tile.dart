import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/customer_document.dart';
import '../document_download_cubit.dart';

/// A tappable document row that downloads via the just-in-time signed link
/// (uses the ambient [DocumentDownloadCubit]). Shows a spinner while resolving.
class DocumentTile extends StatelessWidget {
  const DocumentTile({super.key, required this.document});

  final CustomerDocument document;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return BlocBuilder<DocumentDownloadCubit, DocumentDownloadState>(
      buildWhen: (a, b) =>
          (a.downloadingId == document.id) != (b.downloadingId == document.id),
      builder: (context, state) {
        final downloading = state.downloadingId == document.id;
        return AppCard(
          onTap: downloading
              ? null
              : () => context.read<DocumentDownloadCubit>().open(document.id),
          child: Row(
            children: [
              Icon(
                document.isPdf
                    ? Icons.picture_as_pdf_rounded
                    : Icons.insert_drive_file_outlined,
                color: colors.brandGold,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  document.title.isNotEmpty
                      ? document.title
                      : (document.fileName ?? ''),
                  style: Theme.of(context).textTheme.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (downloading)
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                Icon(Icons.download_rounded, color: colors.inkMuted),
            ],
          ),
        );
      },
    );
  }
}

/// A reusable section that lists documents with a download-failure listener.
/// Host screens must provide a [DocumentDownloadCubit] above this.
class DocumentsSection extends StatelessWidget {
  const DocumentsSection({super.key, required this.documents, this.title});

  final List<CustomerDocument> documents;
  final String? title;

  @override
  Widget build(BuildContext context) {
    if (documents.isEmpty) return const SizedBox.shrink();
    return BlocListener<DocumentDownloadCubit, DocumentDownloadState>(
      listenWhen: (a, b) => a.failure != b.failure && b.failure != null,
      listener: (context, state) => showFailureSnackBar(context, state.failure!),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Text(title!, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
          ],
          for (final doc in documents) ...[
            DocumentTile(document: doc),
            const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ),
    );
  }
}
