import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../documents_list_cubit.dart';
import 'document_tile.dart';

/// Renders the [DocumentsListCubit] states (loading/empty/error/success) and,
/// on success, a [DocumentsSection] wired to the ambient [DocumentDownloadCubit]
/// for just-in-time signed downloads. Host must provide both cubits above this.
class DocumentsListView extends StatelessWidget {
  const DocumentsListView({super.key, this.title, this.emptyMessage});

  final String? title;
  final String? emptyMessage;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BlocBuilder<DocumentsListCubit, DocumentsListState>(
      builder: (context, state) {
        switch (state.status) {
          case DataStatus.initial:
          case DataStatus.loading:
            return const Padding(
              padding: EdgeInsets.all(AppSpacing.lg),
              child: Center(child: CircularProgressIndicator()),
            );
          case DataStatus.failure:
            return ErrorState(
              failure: state.failure,
              onRetry: () => context.read<DocumentsListCubit>().load(),
            );
          case DataStatus.empty:
            return EmptyState(
              icon: Icons.insert_drive_file_outlined,
              title: l10n.documentsEmptyTitle,
              message: emptyMessage ?? l10n.documentsEmptyMessage,
            );
          case DataStatus.success:
            return DocumentsSection(documents: state.data!, title: title);
        }
      },
    );
  }
}
