import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_document.dart';
import '../cubit/documents_cubit.dart';

class StaffDocumentTile extends StatelessWidget {
  const StaffDocumentTile({super.key, required this.document});
  final StaffDocument document;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return BlocBuilder<DocumentsCubit, DocumentsState>(
      buildWhen: (a, b) =>
          (a.downloadingId == document.id) != (b.downloadingId == document.id),
      builder: (context, state) {
        final downloading = state.downloadingId == document.id;
        return AppCard(
          elevation: AppCardElevation.soft,
          onTap: downloading
              ? null
              : () => context.read<DocumentsCubit>().open(document.id),
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
