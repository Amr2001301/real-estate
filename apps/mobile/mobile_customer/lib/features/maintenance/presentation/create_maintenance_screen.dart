import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'create_maintenance_cubit.dart';

/// Form to file a new maintenance request: pick the unit (when not pre-set),
/// one or more categories, a description, and optional photos. Photos upload
/// after the request is created (presign → PUT → register), with per-photo
/// progress and retry of any failures.
class CreateMaintenanceScreen extends StatefulWidget {
  const CreateMaintenanceScreen({super.key});

  @override
  State<CreateMaintenanceScreen> createState() => _CreateMaintenanceScreenState();
}

class _CreateMaintenanceScreenState extends State<CreateMaintenanceScreen> {
  @override
  void initState() {
    super.initState();
    context.read<CreateMaintenanceCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.maintenanceNewRequest)),
      body: BlocConsumer<CreateMaintenanceCubit, CreateMaintenanceState>(
        listenWhen: (a, b) =>
            a.submitted != b.submitted ||
            a.submitFailure != b.submitFailure ||
            a.pickNonce != b.pickNonce,
        listener: (context, state) {
          if (state.submitted) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(l10n.maintenanceSubmitted)));
            context.pop(true);
            return;
          }
          if (state.submitFailure != null) {
            showFailureSnackBar(context, state.submitFailure!);
          }
          if (state.pickIssue != null) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(_pickIssueMessage(l10n, state.pickIssue!))));
            context.read<CreateMaintenanceCubit>().clearPickIssue();
          }
        },
        builder: (context, state) {
          final cubit = context.read<CreateMaintenanceCubit>();
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              if (!state.fixedUnit) ...[
                Text(l10n.maintenanceUnitLabel,
                    style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: AppSpacing.sm),
                _Units(state: state),
                if (state.showValidation && !state.hasUnit) ...[
                  const SizedBox(height: AppSpacing.xs),
                  _ValidationText(l10n.maintenanceUnitRequired),
                ],
                const SizedBox(height: AppSpacing.lg),
              ],
              Text(l10n.maintenanceCategoryLabel,
                  style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: AppSpacing.sm),
              _Categories(state: state),
              if (state.showValidation && !state.hasCategory) ...[
                const SizedBox(height: AppSpacing.xs),
                _ValidationText(l10n.maintenanceCategoryRequired),
              ],
              const SizedBox(height: AppSpacing.lg),
              AppTextField(
                label: l10n.maintenanceDescriptionLabel,
                hint: l10n.maintenanceDescriptionHint,
                maxLines: 5,
                enabled: state.requestId == null,
                onChanged: cubit.setDescription,
                errorText: state.showValidation && !state.hasDescription
                    ? l10n.maintenanceDescriptionRequired
                    : null,
              ),
              const SizedBox(height: AppSpacing.lg),
              _PhotosSection(state: state),
              const SizedBox(height: AppSpacing.xl),
              _SubmitArea(state: state),
            ],
          );
        },
      ),
    );
  }

  String _pickIssueMessage(AppLocalizations l10n, PhotoPickIssue issue) => switch (issue) {
        PhotoPickIssue.permissionDenied => l10n.maintenancePhotoPermissionDenied,
        PhotoPickIssue.tooMany => l10n.maintenancePhotoTooMany(kMaxPhotos),
        PhotoPickIssue.tooLarge => l10n.maintenancePhotoTooLarge(kMaxPhotoBytes ~/ (1024 * 1024)),
        PhotoPickIssue.unsupportedType => l10n.maintenancePhotoUnsupported,
        PhotoPickIssue.unknown => l10n.maintenancePhotoPickFailed,
      };
}

class _SubmitArea extends StatelessWidget {
  const _SubmitArea({required this.state});
  final CreateMaintenanceState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<CreateMaintenanceCubit>();

    if (state.phase == CreatePhase.partial) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.maintenanceUploadPartial(state.failedPhotoCount),
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: context.appColors.error),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: l10n.maintenanceRetryFailed(state.failedPhotoCount),
                  icon: Icons.refresh_rounded,
                  variant: AppButtonVariant.outline,
                  onPressed: cubit.retryFailedUploads,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppButton(
                  label: l10n.maintenanceFinishAnyway,
                  variant: AppButtonVariant.gold,
                  onPressed: cubit.acceptPartial,
                ),
              ),
            ],
          ),
        ],
      );
    }

    return AppButton(
      label: l10n.maintenanceSubmit,
      icon: Icons.send_rounded,
      variant: AppButtonVariant.gold,
      expand: true,
      isLoading: state.busy,
      onPressed: state.busy ? null : cubit.submit,
    );
  }
}

class _PhotosSection extends StatelessWidget {
  const _PhotosSection({required this.state});
  final CreateMaintenanceState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final cubit = context.read<CreateMaintenanceCubit>();
    final maxMb = kMaxPhotoBytes ~/ (1024 * 1024);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.maintenancePhotosLabel,
            style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          l10n.maintenancePhotosHint(kMaxPhotos, maxMb),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (state.photos.isNotEmpty) ...[
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [for (final p in state.photos) _PhotoThumb(photo: p)],
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (state.canAddMorePhotos && state.requestId == null)
          OutlinedButton.icon(
            onPressed: state.busy ? null : () => _openSourceSheet(context, cubit),
            icon: const Icon(Icons.add_a_photo_outlined),
            label: Text(l10n.maintenanceAddPhoto),
          ),
      ],
    );
  }

  Future<void> _openSourceSheet(BuildContext context, CreateMaintenanceCubit cubit) async {
    final l10n = context.l10n;
    await showModalBottomSheet<void>(
      context: context,
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: Text(l10n.maintenanceFromCamera),
              onTap: () {
                Navigator.of(sheetCtx).pop();
                cubit.addFromCamera();
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text(l10n.maintenanceFromGallery),
              onTap: () {
                Navigator.of(sheetCtx).pop();
                cubit.addFromGallery();
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _PhotoThumb extends StatelessWidget {
  const _PhotoThumb({required this.photo});
  final PhotoItem photo;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<CreateMaintenanceCubit>();
    const size = 88.0;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipRRect(
            borderRadius: AppRadii.card,
            child: Image.memory(photo.bytes, fit: BoxFit.cover),
          ),
          if (photo.status == PhotoStatus.uploading ||
              photo.status == PhotoStatus.uploaded ||
              photo.status == PhotoStatus.failed)
            ClipRRect(
              borderRadius: AppRadii.card,
              child: ColoredBox(
                color: Colors.black.withValues(alpha: 0.35),
                child: Center(child: _statusOverlay(context)),
              ),
            ),
          // Remove (only before uploading begins).
          if (photo.status == PhotoStatus.pending && !cubit.state.busy)
            Positioned(
              top: 2,
              right: 2,
              child: GestureDetector(
                onTap: () => cubit.removePhoto(photo.localId),
                child: CircleAvatar(
                  radius: 11,
                  backgroundColor: Colors.black54,
                  child: const Icon(Icons.close_rounded, size: 14, color: Colors.white),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _statusOverlay(BuildContext context) {
    final colors = context.appColors;
    switch (photo.status) {
      case PhotoStatus.uploading:
        return SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(
            strokeWidth: 3,
            value: photo.progress > 0 ? photo.progress : null,
            color: Colors.white,
          ),
        );
      case PhotoStatus.uploaded:
        return Icon(Icons.check_circle_rounded, color: colors.success, semanticLabel: context.l10n.maintenancePhotoUploaded);
      case PhotoStatus.failed:
        return const Icon(Icons.error_outline_rounded, color: Colors.white);
      case PhotoStatus.pending:
        return const SizedBox.shrink();
    }
  }
}

class _Units extends StatelessWidget {
  const _Units({required this.state});
  final CreateMaintenanceState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final cubit = context.read<CreateMaintenanceCubit>();

    switch (state.unitsStatus) {
      case DataStatus.initial:
      case DataStatus.loading:
        return const Padding(
          padding: EdgeInsets.all(AppSpacing.md),
          child: Center(child: CircularProgressIndicator()),
        );
      case DataStatus.failure:
        return ErrorState(failure: state.unitsFailure, onRetry: cubit.loadUnits);
      case DataStatus.empty:
        return EmptyState(
          icon: Icons.home_work_outlined,
          title: l10n.maintenanceNoUnitsTitle,
          message: l10n.maintenanceNoUnitsMessage,
        );
      case DataStatus.success:
        final colors = context.appColors;
        return Column(
          children: [
            for (final unit in state.units) ...[
              AppCard(
                onTap: () => cubit.selectUnit(unit.id),
                child: Row(
                  children: [
                    Icon(
                      state.selectedUnitId == unit.id
                          ? Icons.radio_button_checked_rounded
                          : Icons.radio_button_unchecked_rounded,
                      color: state.selectedUnitId == unit.id
                          ? colors.brandGold
                          : colors.inkMuted,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(unit.label,
                              style: Theme.of(context).textTheme.titleSmall),
                          Text(
                            unit.projectName.resolve(lang),
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: colors.inkMuted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
          ],
        );
    }
  }
}

class _Categories extends StatelessWidget {
  const _Categories({required this.state});
  final CreateMaintenanceState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final cubit = context.read<CreateMaintenanceCubit>();

    switch (state.categoriesStatus) {
      case DataStatus.initial:
      case DataStatus.loading:
        return const Padding(
          padding: EdgeInsets.all(AppSpacing.md),
          child: Center(child: CircularProgressIndicator()),
        );
      case DataStatus.failure:
        return ErrorState(
          failure: state.categoriesFailure,
          onRetry: cubit.loadCategories,
        );
      case DataStatus.empty:
        return EmptyState(
          icon: Icons.category_outlined,
          title: l10n.maintenanceNoCategoriesTitle,
          message: l10n.maintenanceNoCategoriesMessage,
        );
      case DataStatus.success:
        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final category in state.categories)
              FilterChip(
                label: Text(category.name.resolve(lang)),
                selected: state.selectedCategoryIds.contains(category.id),
                onSelected: state.requestId == null
                    ? (_) => cubit.toggleCategory(category.id)
                    : null,
              ),
          ],
        );
    }
  }
}

class _ValidationText extends StatelessWidget {
  const _ValidationText(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context)
          .textTheme
          .bodySmall
          ?.copyWith(color: context.appColors.error),
    );
  }
}
