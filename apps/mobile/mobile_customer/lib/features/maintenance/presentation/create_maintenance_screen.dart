import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'create_maintenance_cubit.dart';

const _navyDeep = Color(0xFF0B1726);
const _navyCard = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

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
          if (state.submitted) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(
                SnackBar(content: Text(l10n.maintenanceSubmitted)),
              );
            context.pop(true);
            return;
          }
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
          return Column(
            children: [
              _Header(l10n: l10n),
              Expanded(
                child: ListView(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.xl + MediaQuery.of(context).padding.bottom,
                  ),
                  children: [
                    // ── Unit picker ──────────────────────────────────────
                    if (!state.fixedUnit) ...[
                      _SectionLabel(label: l10n.maintenanceUnitLabel),
                      const SizedBox(height: AppSpacing.sm),
                      _Units(state: state),
                      if (state.showValidation && !state.hasUnit) ...[
                        const SizedBox(height: AppSpacing.xs),
                        _ValidationText(l10n.maintenanceUnitRequired),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                    ],

                    // ── Categories ───────────────────────────────────────
                    _SectionLabel(label: l10n.maintenanceCategoryLabel),
                    const SizedBox(height: AppSpacing.sm),
                    _Categories(state: state),
                    if (state.showValidation && !state.hasCategory) ...[
                      const SizedBox(height: AppSpacing.xs),
                      _ValidationText(l10n.maintenanceCategoryRequired),
                    ],
                    const SizedBox(height: AppSpacing.lg),

                    // ── Description ──────────────────────────────────────
                    _SectionLabel(label: l10n.maintenanceDescriptionLabel),
                    const SizedBox(height: AppSpacing.sm),
                    _DescriptionField(
                      hint: l10n.maintenanceDescriptionHint,
                      enabled: state.requestId == null,
                      onChanged: cubit.setDescription,
                      errorText: state.showValidation && !state.hasDescription
                          ? l10n.maintenanceDescriptionRequired
                          : null,
                    ),
                    const SizedBox(height: AppSpacing.lg),

                    // ── Photos ───────────────────────────────────────────
                    _PhotosSection(state: state),
                    const SizedBox(height: AppSpacing.xl),

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
    final theme = Theme.of(context);
    final topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [_navyLight, _navyCard, _navyDeep],
            stops: [0.0, 0.45, 1.0],
          ),
          borderRadius: BorderRadius.only(
            bottomLeft: Radius.circular(28),
            bottomRight: Radius.circular(28),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x35000000),
              blurRadius: 22,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            const Positioned.fill(child: IgnorePointer(child: _DotTexture())),
            PositionedDirectional(
              end: 0,
              top: 0,
              child: Container(
                width: 160,
                height: 130,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.topRight,
                    radius: 1.0,
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.09),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 48,
              right: 48,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppPalette.gold400.withValues(alpha: 0.0),
                      AppPalette.gold400.withValues(alpha: 0.5),
                      AppPalette.gold400.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                topInset + AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.xl,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _BackBtn(),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.maintenanceNewRequest,
                          style: theme.textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'أبلغنا عن المشكلة وسنتولى أمرها',
                          style: TextStyle(
                            color: AppPalette.gold300,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.2),
                      ),
                    ),
                    child: const Icon(
                      Icons.build_rounded,
                      color: AppPalette.gold300,
                      size: 20,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Section label ─────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppPalette.gold400, AppPalette.gold300],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w800,
            color: colors.inkStrong,
          ),
        ),
      ],
    );
  }
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
      onPressed: state.busy ? null : cubit.submit,
    );
  }
}

// ── Photos section ────────────────────────────────────────────────────────────

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
        Row(
          children: [
            Container(
              width: 3,
              height: 16,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppPalette.gold400, AppPalette.gold300],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              l10n.maintenancePhotosLabel,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: colors.inkStrong,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsetsDirectional.only(start: 11),
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
                      gradient: const LinearGradient(
                        colors: [_navyLight, _navyDeep],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
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
      decoration: const BoxDecoration(
        color: Color(0xFFF8F6F1),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
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
              decoration: const BoxDecoration(
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
                  iconGradient: const LinearGradient(
                    colors: [_navyLight, _navyDeep],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  iconColor: AppPalette.gold300,
                  title: l10n.maintenanceFromCamera,
                  subtitle: 'التقط صورة الآن مباشرةً',
                  onTap: () {
                    Navigator.of(context).pop();
                    cubit.addFromCamera();
                  },
                ),
                const SizedBox(height: 12),
                _SourceCard(
                  icon: Icons.photo_library_rounded,
                  iconGradient: const LinearGradient(
                    colors: [Color(0xFF7C5200), Color(0xFF3D2800)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  iconColor: AppPalette.gold300,
                  title: l10n.maintenanceFromGallery,
                  subtitle: 'اختر من معرض الصور',
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
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
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
                              ? const Icon(
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
                                unit.label,
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
        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final cat in state.categories) ...[
              GestureDetector(
                onTap: state.requestId == null
                    ? () => cubit.toggleCategory(cat.id)
                    : null,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 9,
                  ),
                  decoration: BoxDecoration(
                    gradient: state.selectedCategoryIds.contains(cat.id)
                        ? const LinearGradient(
                            colors: [_navyLight, _navyDeep],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          )
                        : null,
                    color: state.selectedCategoryIds.contains(cat.id)
                        ? null
                        : colors.surface,
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(
                      color: state.selectedCategoryIds.contains(cat.id)
                          ? Colors.transparent
                          : colors.hairline.withValues(alpha: 0.6),
                      width: 1.5,
                    ),
                    boxShadow: state.selectedCategoryIds.contains(cat.id)
                        ? [
                            BoxShadow(
                              color: _navyDeep.withValues(alpha: 0.3),
                              blurRadius: 10,
                              offset: const Offset(0, 3),
                            ),
                          ]
                        : [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (state.selectedCategoryIds.contains(cat.id)) ...[
                        const Icon(
                          Icons.check_rounded,
                          size: 14,
                          color: AppPalette.gold300,
                        ),
                        const SizedBox(width: 5),
                      ],
                      Text(
                        cat.name.resolve(lang),
                        style: TextStyle(
                          color: state.selectedCategoryIds.contains(cat.id)
                              ? Colors.white
                              : colors.inkStrong,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        );
    }
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

class _BackBtn extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.pop(),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: Colors.white,
          size: 16,
        ),
      ),
    );
  }
}

class _DotTexture extends StatelessWidget {
  const _DotTexture();

  @override
  Widget build(BuildContext context) =>
      const CustomPaint(painter: _DotPainter(), child: SizedBox.expand());
}

class _DotPainter extends CustomPainter {
  const _DotPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const step = 20.0;
    for (var y = 6.0; y < size.height; y += step) {
      for (var x = 6.0; x < size.width; x += step) {
        canvas.drawCircle(Offset(x, y), 1.1, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter _) => false;
}
