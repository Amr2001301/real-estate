import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../cubit/documents_cubit.dart';
import '../widgets/document_tile.dart';

class StaffDocumentsScreen extends StatefulWidget {
  const StaffDocumentsScreen({
    super.key,
    required this.ownerType,
    required this.ownerId,
    this.title,
  });

  final String ownerType;
  final String ownerId;
  final String? title;

  @override
  State<StaffDocumentsScreen> createState() => _StaffDocumentsScreenState();
}

class _StaffDocumentsScreenState extends State<StaffDocumentsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<DocumentsCubit>().load(widget.ownerType, widget.ownerId);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<DocumentsCubit>();

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(
            title: widget.title ?? l10n.contractsDocumentsTitle,
            compact: true,
            leadingAction: NavHeaderAction(
              icon: Icons.arrow_back_ios_new_rounded,
              onTap: () => context.pop(),
            ),
          ),
          Expanded(
            child: BlocConsumer<DocumentsCubit, DocumentsState>(
              listenWhen: (a, b) =>
                  a.downloadFailure != b.downloadFailure && b.downloadFailure != null,
              listener: (context, state) =>
                  showFailureSnackBar(context, state.downloadFailure!),
              builder: (context, state) {
                switch (state.status) {
                  case DataStatus.initial:
                  case DataStatus.loading:
                    return const StaffListSkeleton();
                  case DataStatus.failure:
                    return ErrorState(
                      failure: state.failure,
                      onRetry: () => cubit.load(widget.ownerType, widget.ownerId),
                    );
                  case DataStatus.empty:
                    return EmptyState(
                      icon: Icons.folder_open_outlined,
                      title: l10n.documentsEmptyTitle,
                      message: l10n.documentsEmptyMessage,
                    );
                  case DataStatus.success:
                    return RefreshIndicator(
                      onRefresh: () => cubit.load(widget.ownerType, widget.ownerId),
                      child: ListView.separated(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        itemCount: state.documents.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, i) =>
                            StaffDocumentTile(document: state.documents[i]),
                      ),
                    );
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}
