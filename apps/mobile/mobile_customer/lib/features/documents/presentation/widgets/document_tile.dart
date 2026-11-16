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
        if (document.isImage) return DocumentImageTile(document: document);
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


/// A picture document shown as the picture itself (not a download row). Tap opens it full
/// screen to zoom; the download button there (and on the tile) saves/opens the file.
class DocumentImageTile extends StatefulWidget {
  const DocumentImageTile({super.key, required this.document});

  final CustomerDocument document;

  @override
  State<DocumentImageTile> createState() => _DocumentImageTileState();
}

class _DocumentImageTileState extends State<DocumentImageTile> {
  late final Future<Result<DocumentDownloadLink>> _link;

  @override
  void initState() {
    super.initState();
    // One fresh signed link per tile; the picture is drawn from it.
    _link = context.read<DocumentDownloadCubit>().link(widget.document.id);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final doc = widget.document;
    final title = doc.title.isNotEmpty ? doc.title : (doc.fileName ?? '');
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FutureBuilder<Result<DocumentDownloadLink>>(
            future: _link,
            builder: (context, snap) {
              final url = snap.data?.dataOrNull?.url;
              if (snap.connectionState != ConnectionState.done) {
                return const AspectRatio(aspectRatio: 16 / 10, child: Center(child: CircularProgressIndicator(strokeWidth: 2)));
              }
              if (url == null) {
                return AspectRatio(
                  aspectRatio: 16 / 6,
                  child: Center(child: Icon(Icons.broken_image_outlined, color: colors.inkMuted, size: 32)),
                );
              }
              return GestureDetector(
                key: Key('document-image-${doc.id}'),
                onTap: () => _openViewer(context, url, title),
                child: AspectRatio(
                  aspectRatio: 16 / 10,
                  child: Image.network(
                    url,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Center(child: Icon(Icons.broken_image_outlined, color: colors.inkMuted, size: 32)),
                    loadingBuilder: (context, child, progress) =>
                        progress == null ? child : const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                  ),
                ),
              );
            },
          ),
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(14, 8, 6, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleSmall),
                ),
                IconButton(
                  tooltip: context.l10n.actionDownload,
                  icon: Icon(Icons.download_rounded, color: colors.inkMuted),
                  onPressed: () => context.read<DocumentDownloadCubit>().open(doc.id),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _openViewer(BuildContext context, String url, String title) {
    final cubit = context.read<DocumentDownloadCubit>();
    Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.black,
            foregroundColor: Colors.white,
            title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
            actions: [
              IconButton(
                tooltip: context.l10n.actionDownload,
                icon: const Icon(Icons.download_rounded),
                onPressed: () => cubit.open(widget.document.id),
              ),
            ],
          ),
          body: InteractiveViewer(
            minScale: 1,
            maxScale: 6,
            child: Center(child: Image.network(url, fit: BoxFit.contain)),
          ),
        ),
      ),
    );
  }
}
