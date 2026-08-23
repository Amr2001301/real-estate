import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/staff_document.dart';
import '../cubit/documents_cubit.dart';

class StaffDocumentTile extends StatefulWidget {
  const StaffDocumentTile({super.key, required this.document});
  final StaffDocument document;

  @override
  State<StaffDocumentTile> createState() => _StaffDocumentTileState();
}

class _StaffDocumentTileState extends State<StaffDocumentTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final doc = widget.document;

    final isPdf = doc.isPdf;
    final iconColor =
        isPdf ? const Color(0xFFEF4444) : const Color(0xFF3B82F6);
    final iconBg = iconColor.withValues(alpha: 0.10);
    final iconBorder = iconColor.withValues(alpha: 0.22);
    final iconData = isPdf
        ? Icons.picture_as_pdf_rounded
        : Icons.insert_drive_file_outlined;

    return BlocBuilder<DocumentsCubit, DocumentsState>(
      buildWhen: (a, b) =>
          (a.downloadingId == doc.id) != (b.downloadingId == doc.id),
      builder: (context, state) {
        final downloading = state.downloadingId == doc.id;
        return GestureDetector(
          onTapDown: downloading ? null : (_) => setState(() => _pressed = true),
          onTapUp: downloading ? null : (_) => setState(() => _pressed = false),
          onTapCancel: downloading ? null : () => setState(() => _pressed = false),
          onTap: downloading
              ? null
              : () => context.read<DocumentsCubit>().open(doc.id),
          child: AnimatedScale(
            scale: _pressed ? 0.975 : 1.0,
            duration: const Duration(milliseconds: 100),
            child: Container(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(AppRadii.lg),
                border:
                    Border.all(color: colors.hairline.withValues(alpha: 0.5)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md, vertical: AppSpacing.sm + 2),
              child: Row(
                children: [
                  // File type icon circle
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: iconBg,
                      shape: BoxShape.circle,
                      border: Border.all(color: iconBorder),
                    ),
                    child: Icon(iconData, size: 20, color: iconColor),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  // Title + subtitle
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          doc.title.isNotEmpty ? doc.title : (doc.fileName ?? ''),
                          style:
                              Theme.of(context).textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (doc.title.isNotEmpty && doc.fileName != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            doc.fileName!,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: colors.inkMuted),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ] else if (doc.category != null) ...[
                          const SizedBox(height: 3),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: colors.surfaceSoft,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              doc.category!,
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(color: colors.inkMuted),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  // Action indicator
                  if (downloading)
                    SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: colors.brandGold,
                      ),
                    )
                  else
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: colors.brandGold.withValues(alpha: 0.08),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.download_rounded,
                        size: 16,
                        color: colors.brandGold,
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
