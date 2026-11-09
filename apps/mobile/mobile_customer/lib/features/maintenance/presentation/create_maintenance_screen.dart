import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'create_maintenance_cubit.dart';

Color get _navyDeep => AppPalette.navyDeep;
Color get _navyLight => AppPalette.navyLight;

// ─────────────────────────────────────────────────────────────────────────────
// Create Maintenance Screen
// ─────────────────────────────────────────────────────────────────────────────

class CreateMaintenanceScreen extends StatefulWidget {
  const CreateMaintenanceScreen({super.key});

  @override
  State<CreateMaintenanceScreen> createState() =>
      _CreateMaintenanceScreenState();
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
      backgroundColor: context.appColors.canvas,
      body: BlocConsumer<CreateMaintenanceCubit, CreateMaintenanceState>(
        listenWhen: (a, b) =>
            a.submitted != b.submitted ||
            a.submitFailure != b.submitFailure ||
            a.pickNonce != b.pickNonce,
        listener: (context, state) {
          // Sent: the builder shows the confirmation in place.
          if (state.submitted) return;
          if (state.submitFailure != null) {
            showFailureSnackBar(context, state.submitFailure!);
          }
          if (state.pickIssue != null) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(
                SnackBar(content: Text(_pickMsg(l10n, state.pickIssue!))),
              );
            context.read<CreateMaintenanceCubit>().clearPickIssue();
          }
        },
        builder: (context, state) {
          final cubit = context.read<CreateMaintenanceCubit>();
          if (state.submitted) return _Done(l10n: l10n);
          final step = _StepCounter();
          return Column(
            children: [
              _Header(l10n: l10n),
              Expanded(
                child: ListView(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.xl + MediaQuery.of(context).padding.bottom,
                  ),
                  children: [
                    if (state.unitNotHandedOver) ...[
                      _HandoverNotice(text: l10n.maintenanceBeforeHandover),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    // ── Unit picker ──────────────────────────────────────
                    if (!state.fixedUnit)
                      _StepCard(
                        children: [
                          _SectionLabel(
                            label: l10n.maintenanceUnitLabel,
                            step: step.next(),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          _Units(state: state),
                          if (state.showValidation && !state.hasUnit) ...[
                            const SizedBox(height: AppSpacing.xs),
                            _ValidationText(l10n.maintenanceUnitRequired),
                          ],
                        ],
                      ),

                    // ── Categories ───────────────────────────────────────
                    _StepCard(
                      children: [
                        _SectionLabel(
                          label: l10n.maintenanceCategoryLabel,
                          step: step.next(),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _Categories(state: state),
                        if (state.showValidation && !state.hasCategory) ...[
                          const SizedBox(height: AppSpacing.xs),
                          _ValidationText(l10n.maintenanceCategoryRequired),
                        ],
                      ],
                    ),

                    // ── Description ──────────────────────────────────────
                    _StepCard(
                      children: [
                        _SectionLabel(
                          label: l10n.maintenanceDescriptionLabel,
                          step: step.next(),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _DescriptionField(
                          hint: l10n.maintenanceDescriptionHint,
                          enabled: state.requestId == null,
                          onChanged: cubit.setDescription,
                          errorText:
                              state.showValidation && !state.hasDescription
                              ? l10n.maintenanceDescriptionRequired
                              : null,
                        ),
                      ],
                    ),

                    // ── Photos ───────────────────────────────────────────
                    _StepCard(
                      children: [
                        _PhotosSection(state: state, step: step.next()),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),

                    // ── Submit ───────────────────────────────────────────
                    _SubmitArea(state: state),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  String _pickMsg(AppLocalizations l, PhotoPickIssue issue) => switch (issue) {
    PhotoPickIssue.permissionDenied => l.maintenancePhotoPermissionDenied,
    PhotoPickIssue.tooMany => l.maintenancePhotoTooMany(kMaxPhotos),
    PhotoPickIssue.tooLarge => l.maintenancePhotoTooLarge(
      kMaxPhotoBytes ~/ (1024 * 1024),
    ),
    PhotoPickIssue.unsupportedType => l.maintenancePhotoUnsupported,
    PhotoPickIssue.unknown => l.maintenancePhotoPickFailed,
  };
}

// ── Header ────────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  const _Header({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return AppNavHeader(
      title: l10n.maintenanceNewRequest,
      subtitle: l10n.maintenanceNewSubtitle,
      compact: true,
      leadingAction: const NavHeaderBack(),
    );
  }
}

// ── Section label ─────────────────────────────────────────────────────────────

/// Numbers the form's sections in the order they show (the unit step is
/// left out when the unit is already chosen).
class _StepCounter {
  int _n = 0;
  int next() => ++_n;
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label, this.step});
  final String label;

  /// The step's number, in a gold tile.
  final int? step;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 26,
          height: 26,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppPalette.gold50,
            border: Border.all(color: AppPalette.gold100),
            borderRadius: BorderRadius.circular(9),
          ),
          child: step == null
              ? Icon(
                  Icons.auto_awesome_rounded,
                  size: 16,
                  color: AppPalette.gold500,
                )
              : Text(
                  '$step',
                  style: TextStyle(
                    color: AppPalette.gold600,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
        ),
        const SizedBox(width: 9),
        Expanded(child: Text(label, style: homeDisplay(17, colors.inkStrong))),
      ],
    );
  }
}

/// A step of the form in its own card, as in the other request forms.
class _StepCard extends StatelessWidget {
  const _StepCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: AppSpacing.md),
    padding: const EdgeInsets.all(14),
    decoration: homeCard(context, radius: 22),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    ),
  );
}

// ── Description field ─────────────────────────────────────────────────────────

class _DescriptionField extends StatelessWidget {
  const _DescriptionField({
    required this.hint,
    required this.enabled,
    required this.onChanged,
    this.errorText,
  });

  final String hint;
  final bool enabled;
  final ValueChanged<String> onChanged;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: errorText != null
                  ? colors.error.withValues(alpha: 0.5)
                  : colors.hairline.withValues(alpha: 0.6),
              width: errorText != null ? 1.5 : 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: TextField(
            enabled: enabled,
            onChanged: onChanged,
            maxLines: 5,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: TextStyle(
                color: colors.inkMuted.withValues(alpha: 0.6),
                fontSize: 14,
              ),
              contentPadding: const EdgeInsets.all(AppSpacing.md),
              border: InputBorder.none,
            ),
          ),
        ),
        if (errorText != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(errorText!, style: TextStyle(color: colors.error, fontSize: 12)),
        ],
      ],
    );
  }
}

// ── Submit area ───────────────────────────────────────────────────────────────

class _SubmitArea extends StatelessWidget {
  const _SubmitArea({required this.state});
  final CreateMaintenanceState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<CreateMaintenanceCubit>();
    final colors = context.appColors;
    final theme = Theme.of(context);

    if (state.phase == CreatePhase.partial) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: colors.error.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colors.error.withValues(alpha: 0.2)),
            ),
            child: Text(
              l10n.maintenanceUploadPartial(state.failedPhotoCount),
              style: theme.textTheme.bodyMedium?.copyWith(color: colors.error),
              textAlign: TextAlign.center,
            ),
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
      onPressed: state.busy || state.unitNotHandedOver ? null : cubit.submit,
    );
  }
}

// ── Photos section ────────────────────────────────────────────────────────────

class _PhotosSection extends StatelessWidget {
  const _PhotosSection({required this.state, this.step});
  final CreateMaintenanceState state;
  final int? step;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final cubit = context.read<CreateMaintenanceCubit>();
    final maxMb = kMaxPhotoBytes ~/ (1024 * 1024);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionLabel(label: l10n.maintenancePhotosLabel, step: step),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsetsDirectional.only(start: 34),
          child: Text(
            l10n.maintenancePhotosHint(kMaxPhotos, maxMb),
            style: TextStyle(color: colors.inkMuted, fontSize: 12),
          ),
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
          GestureDetector(
            onTap: state.busy ? null : () => _openSourceSheet(context, cubit),
            child: Container(
              height: 48,
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(13),
                border: Border.all(
                  color: _navyLight.withValues(alpha: 0.3),
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [_navyLight, _navyDeep],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.add_a_photo_outlined,
                      color: AppPalette.gold300,
                      size: 15,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    l10n.maintenanceAddPhoto,
                    style: TextStyle(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Future<void> _openSourceSheet(
    BuildContext context,
    CreateMaintenanceCubit cubit,
  ) async {
    final l10n = context.l10n;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _PhotoSourceSheet(l10n: l10n, cubit: cubit),
    );
  }
}

// ── Photo source sheet ────────────────────────────────────────────────────────

class _PhotoSourceSheet extends StatelessWidget {
  const _PhotoSourceSheet({required this.l10n, required this.cubit});
  final AppLocalizations l10n;
  final CreateMaintenanceCubit cubit;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return Container(
      decoration: BoxDecoration(
        color: colors.canvas,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Drag handle ────────────────────────────────────────────────────
          Container(
            width: 44,
            height: 4,
            margin: const EdgeInsets.only(top: 12, bottom: 4),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // ── Title row ──────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      l10n.maintenancePhotosLabel,
                      style: TextStyle(
                        color: colors.inkStrong,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.06),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: colors.inkStrong,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ── Gold divider ───────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            child: Container(
              height: 1,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppPalette.gold400,
                    AppPalette.gold300,
                    Color(0x00D4AF37),
                  ],
                  begin: AlignmentDirectional.centerEnd,
                  end: AlignmentDirectional.centerStart,
                ),
              ),
            ),
          ),

          // ── Cards ──────────────────────────────────────────────────────────
          Padding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + bottomInset),
            child: Column(
              children: [
                _SourceCard(
                  icon: Icons.photo_camera_rounded,
                  iconGradient: LinearGradient(
                    colors: [_navyLight, _navyDeep],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  iconColor: AppPalette.gold300,
                  title: l10n.maintenanceFromCamera,
                  subtitle: l10n.maintenanceFromCameraHint,
                  onTap: () {
                    Navigator.of(context).pop();
                    cubit.addFromCamera();
                  },
                ),
                const SizedBox(height: 12),
                _SourceCard(
                  icon: Icons.photo_library_rounded,
                  iconGradient: LinearGradient(
                    colors: [AppPalette.goldBrown4, AppPalette.goldBrown3],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  iconColor: AppPalette.gold300,
                  title: l10n.maintenanceFromGallery,
                  subtitle: l10n.maintenanceFromGalleryHint,
                  onTap: () {
                    Navigator.of(context).pop();
                    cubit.addFromGallery();
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SourceCard extends StatelessWidget {
  const _SourceCard({
    required this.icon,
    required this.iconGradient,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Gradient iconGradient;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: context.appColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: context.appColors.hairline),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 12,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            // Icon tile
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                gradient: iconGradient,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(width: 16),
            // Text
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: colors.inkStrong,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: colors.inkMuted,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Chevron
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.arrow_back_ios_new_rounded,
                size: 13,
                color: colors.inkMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Photo thumb ───────────────────────────────────────────────────────────────

class _PhotoThumb extends StatelessWidget {
  const _PhotoThumb({required this.photo});
  final PhotoItem photo;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<CreateMaintenanceCubit>();
    final colors = context.appColors;
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
                child: Center(child: _statusOverlay(context, colors)),
              ),
            ),
          if (photo.status == PhotoStatus.pending && !cubit.state.busy)
            Positioned(
              top: 2,
              right: 2,
              child: GestureDetector(
                onTap: () => cubit.removePhoto(photo.localId),
                child: CircleAvatar(
                  radius: 11,
                  backgroundColor: Colors.black54,
                  child: const Icon(
                    Icons.close_rounded,
                    size: 14,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _statusOverlay(BuildContext context, AppColorsExt colors) {
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
        return Icon(
          Icons.check_circle_rounded,
          color: colors.success,
          semanticLabel: context.l10n.maintenancePhotoUploaded,
        );
      case PhotoStatus.failed:
        return const Icon(Icons.error_outline_rounded, color: Colors.white);
      case PhotoStatus.pending:
        return const SizedBox.shrink();
    }
  }
}

// ── Unit picker ───────────────────────────────────────────────────────────────

class _Units extends StatelessWidget {
  const _Units({required this.state});
  final CreateMaintenanceState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final cubit = context.read<CreateMaintenanceCubit>();
    final colors = context.appColors;
    final theme = Theme.of(context);

    switch (state.unitsStatus) {
      case DataStatus.initial:
      case DataStatus.loading:
        return const Padding(
          padding: EdgeInsets.all(AppSpacing.md),
          child: Center(child: CircularProgressIndicator()),
        );
      case DataStatus.failure:
        return ErrorState(
          failure: state.unitsFailure,
          onRetry: cubit.loadUnits,
        );
      case DataStatus.empty:
        return EmptyState(
          icon: Icons.home_work_outlined,
          title: l10n.maintenanceNoUnitsTitle,
          message: l10n.maintenanceNoUnitsMessage,
        );
      case DataStatus.success:
        return Column(
          children: [
            for (final unit in state.units) ...[
              GestureDetector(
                onTap: () => cubit.selectUnit(unit.id),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  decoration: BoxDecoration(
                    color: state.selectedUnitId == unit.id
                        ? _navyDeep
                        : colors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: state.selectedUnitId == unit.id
                          ? AppPalette.gold300.withValues(alpha: 0.5)
                          : colors.hairline.withValues(alpha: 0.5),
                      width: state.selectedUnitId == unit.id ? 1.5 : 1.0,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: state.selectedUnitId == unit.id
                            ? _navyDeep.withValues(alpha: 0.25)
                            : Colors.black.withValues(alpha: 0.04),
                        blurRadius: state.selectedUnitId == unit.id ? 14 : 6,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.md,
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: state.selectedUnitId == unit.id
                                  ? AppPalette.gold300
                                  : colors.inkMuted.withValues(alpha: 0.4),
                              width: 2,
                            ),
                            color: state.selectedUnitId == unit.id
                                ? AppPalette.gold300
                                : Colors.transparent,
                          ),
                          child: state.selectedUnitId == unit.id
                              ? Icon(
                                  Icons.check_rounded,
                                  size: 13,
                                  color: _navyDeep,
                                )
                              : null,
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                unit.label(
                                  Localizations.localeOf(context).languageCode,
                                ),
                                style: theme.textTheme.titleSmall?.copyWith(
                                  color: state.selectedUnitId == unit.id
                                      ? Colors.white
                                      : colors.inkStrong,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                unit.projectName.resolve(lang),
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: state.selectedUnitId == unit.id
                                      ? AppPalette.gold300
                                      : colors.inkMuted,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
          ],
        );
    }
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

class _Categories extends StatelessWidget {
  const _Categories({required this.state});
  final CreateMaintenanceState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final cubit = context.read<CreateMaintenanceCubit>();
    final colors = context.appColors;

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
        return GridView.count(
          key: const Key('maintenance-categories'),
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: AppSpacing.sm,
          crossAxisSpacing: AppSpacing.sm,
          childAspectRatio: 1.05,
          children: [
            for (final cat in state.categories)
              _CategoryTile(
                label: cat.name.resolve(lang),
                icon: maintenanceCategoryIcon('${cat.name.ar} ${cat.name.en}'),
                selected: state.selectedCategoryIds.contains(cat.id),
                onTap: state.requestId == null
                    ? () => cubit.toggleCategory(cat.id)
                    : null,
                colors: colors,
              ),
          ],
        );
    }
  }
}

/// An icon for a maintenance category, from its name (the company names them).
IconData maintenanceCategoryIcon(String name) {
  final n = name.toLowerCase();
  bool has(List<String> w) => w.any(n.contains);
  if (has(['سباك', 'plumb', 'مياه', 'water'])) return Icons.plumbing_rounded;
  if (has(['كهرب', 'electric'])) return Icons.electrical_services_rounded;
  if (has(['تكييف', 'تبريد', 'air', 'ac', 'hvac'])) {
    return Icons.ac_unit_rounded;
  }
  if (has(['نجار', 'carpent', 'wood', 'أبواب', 'door'])) {
    return Icons.carpenter_rounded;
  }
  if (has(['دهان', 'نقاش', 'paint'])) return Icons.format_paint_rounded;
  if (has(['مصعد', 'أسانسير', 'elevator', 'lift'])) {
    return Icons.elevator_rounded;
  }
  if (has(['حديقة', 'زراعة', 'garden', 'landscape'])) return Icons.yard_rounded;
  if (has(['أمن', 'حراسة', 'security'])) return Icons.security_rounded;
  if (has(['نظافة', 'clean'])) return Icons.cleaning_services_rounded;
  return Icons.handyman_rounded;
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
    required this.colors,
  });
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback? onTap;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          gradient: selected
              ? LinearGradient(
                  colors: [_navyLight, _navyDeep],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: selected ? null : colors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected
                ? AppPalette.gold400
                : colors.hairline.withValues(alpha: 0.7),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: selected
                  ? _navyDeep.withValues(alpha: 0.25)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: selected ? 12 : 4,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: selected
                          ? Colors.white.withValues(alpha: 0.1)
                          : AppPalette.gold400.withValues(alpha: 0.14),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      icon,
                      size: 22,
                      color: selected ? AppPalette.gold300 : AppPalette.gold500,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    label,
                    maxLines: 2,
                    textAlign: TextAlign.center,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: selected ? Colors.white : colors.inkStrong,
                      fontWeight: FontWeight.w700,
                      fontSize: 12.5,
                    ),
                  ),
                ],
              ),
            ),
            if (selected)
              PositionedDirectional(
                top: 0,
                end: 0,
                child: Icon(
                  Icons.check_circle_rounded,
                  size: 18,
                  color: AppPalette.gold300,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Shown once the request is sent: what happens next, and the way back to
/// the requests (which reload) or home.
class _Done extends StatelessWidget {
  const _Done({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Column(
      children: [
        _Header(l10n: l10n),
        Expanded(
          child: Center(
            key: const Key('maintenance-done'),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                      color: colors.success.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.check_circle_rounded,
                      size: 52,
                      color: colors.success,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    l10n.maintenanceDoneTitle,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: colors.inkStrong,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    l10n.maintenanceDoneMessage,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.inkMuted,
                      height: 1.6,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  AppButton(
                    label: l10n.maintenanceDoneBack,
                    icon: Icons.build_rounded,
                    expand: true,
                    onPressed: () => context.canPop()
                        ? context.pop(true)
                        : context.go('/account/maintenance'),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppButton(
                    label: l10n.maintenanceDoneHome,
                    icon: Icons.home_rounded,
                    variant: AppButtonVariant.outline,
                    expand: true,
                    onPressed: () => context.go('/home'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Not handed over ───────────────────────────────────────────────────────────

class _HandoverNotice extends StatelessWidget {
  const _HandoverNotice({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppPalette.gold50,
        border: Border.all(color: AppPalette.gold100),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.key_rounded, size: 20, color: AppPalette.gold500),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              text,
              style: TextStyle(color: _navyDeep, fontSize: 13.5, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Validation text ───────────────────────────────────────────────────────────

class _ValidationText extends StatelessWidget {
  const _ValidationText(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(
          Icons.error_outline_rounded,
          size: 13,
          color: context.appColors.error,
        ),
        const SizedBox(width: 4),
        Text(
          text,
          style: TextStyle(color: context.appColors.error, fontSize: 12),
        ),
      ],
    );
  }
}

// ── Shared ────────────────────────────────────────────────────────────────────
