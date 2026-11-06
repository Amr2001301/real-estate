import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../documents/domain/entities/customer_document.dart';
import '../../documents/presentation/document_download_cubit.dart';
import '../../documents/presentation/documents_list_cubit.dart';
import '../domain/entities/maintenance_request.dart';
import 'maintenance_detail_cubit.dart';
import 'maintenance_format.dart';

// ─── colour palette ──────────────────────────────────────────────────────────
Color get _navyDeep => AppPalette.navyDeep;
Color get _navyCard => AppPalette.navyPanel;
Color get _navyLight => AppPalette.navyLight;

List<Color> _statusGradient(MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.open || MaintenanceStatus.assigned => [_navyLight, _navyDeep],
      MaintenanceStatus.inProgress =>
        [const Color(0xFF0F3460), const Color(0xFF061830)],
      _ => [const Color(0xFF1B5E3F), const Color(0xFF0D3826)],
    };

Color _statusAccent(MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.open || MaintenanceStatus.assigned => AppPalette.gold300,
      MaintenanceStatus.inProgress => const Color(0xFF60A5FA),
      _ => const Color(0xFF4ADE80),
    };

IconData _statusIcon(MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.open     => Icons.inbox_rounded,
      MaintenanceStatus.assigned => Icons.person_pin_rounded,
      MaintenanceStatus.inProgress => Icons.engineering_rounded,
      MaintenanceStatus.resolved => Icons.check_circle_rounded,
      MaintenanceStatus.closed   => Icons.lock_rounded,
      _                          => Icons.build_rounded,
    };

Color _priorityColor(MaintenancePriority p) => switch (p) {
      MaintenancePriority.low    => const Color(0xFF6B7280),
      MaintenancePriority.medium => AppPalette.gold300,
      MaintenancePriority.high   => const Color(0xFFF97316),
      MaintenancePriority.urgent => const Color(0xFFEF4444),
      _                          => const Color(0xFF6B7280),
    };

// ─── root screen ─────────────────────────────────────────────────────────────
class MaintenanceRequestDetailScreen extends StatelessWidget {
  const MaintenanceRequestDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n   = context.l10n;
    final lang   = Localizations.localeOf(context).languageCode;
    final bottom = MediaQuery.of(context).padding.bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: BlocBuilder<MaintenanceDetailCubit, MaintenanceDetailState>(
        builder: (context, state) {
          final request  = state.request;
          final gradient = _statusGradient(request.status);
          final accent   = _statusAccent(request.status);
          final icon     = _statusIcon(request.status);

          return Scaffold(
            backgroundColor: context.appColors.canvas,
            body: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _DetailHeader(
                    request: request,
                    l10n: l10n,
                    gradient: gradient,
                    accent: accent,
                  ),
                ),
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(16, 20, 16, 96 + bottom),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      _SummaryCard(
                        request: request,
                        l10n: l10n,
                        lang: lang,
                        gradient: gradient,
                        accent: accent,
                        icon: icon,
                      ),
                      const SizedBox(height: 16),
                      _ResolutionCard(request: request, submitting: state.submitting),
                      const SizedBox(height: 16),
                      _AttachmentsSection(l10n: l10n),
                    ]),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ─── header ──────────────────────────────────────────────────────────────────
class _DetailHeader extends StatelessWidget {
  const _DetailHeader({
    required this.request,
    required this.l10n,
    required this.gradient,
    required this.accent,
  });

  final MaintenanceRequest request;
  final AppLocalizations    l10n;
  final List<Color>         gradient;
  final Color               accent;

  @override
  Widget build(BuildContext context) {
    return AppNavHeader(
      title: context.l10n.maintenanceDetailTitle,
      subtitle: context.l10n.maintenanceFallbackTitle,
      compact: true,
      leadingAction: const NavHeaderBack(),
      actions: [NavHeaderPill(label: maintenanceStatusLabel(l10n, request.status), color: accent)],
    );
  }
}

// ─── summary card ─────────────────────────────────────────────────────────────
class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.request,
    required this.l10n,
    required this.lang,
    required this.gradient,
    required this.accent,
    required this.icon,
  });

  final MaintenanceRequest request;
  final AppLocalizations    l10n;
  final String              lang;
  final List<Color>         gradient;
  final Color               accent;
  final IconData            icon;

  @override
  Widget build(BuildContext context) {
    final category     = request.categoryName?.resolve(lang);
    final priorityLabel = maintenancePriorityLabel(l10n, request.priority);
    final priorityColor = _priorityColor(request.priority);
    final date = request.createdAt != null
        ? DateFormatter.mediumDate(request.createdAt!, languageCode: lang)
        : null;

    final colors = context.appColors;
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final tileAccent = dark ? accent : _lightAccent(request.status);

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.6)),
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: tileAccent.withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: tileAccent, size: 24),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      category?.isNotEmpty == true
                          ? category!
                          : context.l10n.maintenanceFallbackTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: colors.inkStrong,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (request.unitCode != null)
                      Text(
                        context.l10n.unitTitle(request.unitCode!),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colors.inkMuted,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: priorityColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  priorityLabel,
                  style: TextStyle(
                    color: priorityColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Divider(height: 1, color: colors.hairline),
          const SizedBox(height: AppSpacing.md),
          Text(
            request.description,
            maxLines: 5,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colors.ink,
              height: 1.6,
            ),
          ),
          if (date != null) ...[
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Icon(AppIcons.calendar, size: 14, color: colors.inkMuted),
                const SizedBox(width: 4),
                Text(
                  date,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colors.inkMuted,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

Color _lightAccent(MaintenanceStatus s) => switch (s) {
      MaintenanceStatus.inProgress => const Color(0xFF1D4ED8),
      MaintenanceStatus.open || MaintenanceStatus.assigned =>
        const Color(0xFF9A6F1E),
      _ => const Color(0xFF15803D),
    };

// ─── resolution card ──────────────────────────────────────────────────────────
class _ResolutionCard extends StatelessWidget {
  const _ResolutionCard({required this.request, required this.submitting});

  final MaintenanceRequest request;
  final bool               submitting;

  String _dateStr(BuildContext context, DateTime? d) => d == null
      ? '—'
      : DateFormatter.mediumDate(
          d,
          languageCode: Localizations.localeOf(context).languageCode,
        );

  ({String label, Color color}) _resolvedByInfo(AppLocalizations l10n) => switch (request.resolvedBy) {
        MaintenanceResolvedBy.both =>
          (label: l10n.maintenanceResolvedByBoth, color: const Color(0xFF4ADE80)),
        MaintenanceResolvedBy.customer =>
          (label: l10n.maintenanceResolvedByCustomer, color: AppPalette.gold300),
        MaintenanceResolvedBy.supervisor =>
          (label: l10n.maintenanceResolvedBySupervisor, color: AppPalette.gold300),
        null =>
          (label: l10n.maintenanceResolvedByNone, color: const Color(0xFF9CA3AF)),
      };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.appColors;
    final rb = _resolvedByInfo(context.l10n);

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        color: context.appColors.surface,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Card header
            Container(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: context.appColors.hairline)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: _navyCard,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.checklist_rounded, color: Colors.white, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    context.l10n.maintenanceFollowUpTitle,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: context.appColors.inkStrong,
                    ),
                  ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Status pills
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _StatusPill(label: rb.label, color: rb.color),
                      if (request.isOverdue)
                        _StatusPill(
                            label: context.l10n.supervisorDetailOverdueLabel, color: Color(0xFFEF4444)),
                      if (request.unresolvedAt != null)
                        _StatusPill(label: context.l10n.maintenanceUnresolved, color: Color(0xFFEF4444)),
                      if (request.complaintAt != null)
                        _StatusPill(
                            label: context.l10n.supervisorDetailComplaintLabel, color: Color(0xFFF97316)),
                    ],
                  ),
                  const SizedBox(height: 14),
                  // Info rows
                  _InfoRow(
                    icon: Icons.schedule_rounded,
                    label: context.l10n.maintenanceTargetDate,
                    value: request.dueAt != null
                        ? _dateStr(context, request.dueAt)
                        : context.l10n.maintenanceStartsAfterApproval,
                  ),
                  _InfoRow(
                    icon: Icons.verified_rounded,
                    label: context.l10n.maintenanceSupervisorConfirmation,
                    value: request.supervisorConfirmedResolutionAt != null
                        ? _dateStr(context, request.supervisorConfirmedResolutionAt)
                        : context.l10n.maintenanceResolvedByNone,
                  ),
                  if (request.complaintAt != null)
                    _InfoRow(
                      icon: Icons.report_rounded,
                      label: context.l10n.supervisorDetailComplaintDateLabel,
                      value: _dateStr(context, request.complaintAt),
                    ),
                ],
              ),
            ),

            // Complaint action
            if (request.canComplain) ...[
              const Divider(height: 1, indent: 16, endIndent: 16),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n.maintenanceOverdueComplaintHint,
                      style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                    ),
                    const SizedBox(height: 10),
                    AppButton(
                      label: context.l10n.maintenanceFileComplaint,
                      variant: AppButtonVariant.outline,
                      size: AppButtonSize.medium,
                      isLoading: submitting,
                      onPressed: submitting ? null : () => _complain(context),
                    ),
                  ],
                ),
              ),
            ],

            // Rating: read-only once confirmed
            if (request.customerHasConfirmed) ...[
              const Divider(height: 1, indent: 16, endIndent: 16),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n.maintenanceYourRating,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: context.appColors.inkStrong,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _StarsReadOnly(value: request.customerRating ?? 0),
                    if (request.customerRatingText?.isNotEmpty == true) ...[
                      const SizedBox(height: 6),
                      Text(request.customerRatingText!, style: theme.textTheme.bodyMedium),
                    ],
                    const SizedBox(height: 4),
                    Text(
                      context.l10n.maintenanceYouConfirmedOn(_dateStr(context, request.customerConfirmedResolutionAt)),
                      style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                    ),
                  ],
                ),
              ),
            ] else if (request.canConfirmResolution) ...[
              const Divider(height: 1, indent: 16, endIndent: 16),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: _ConfirmResolutionForm(submitting: submitting),
              ),
            ] else ...[
              const SizedBox(height: 12),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _complain(BuildContext context) async {
    final failure = await context.read<MaintenanceDetailCubit>().submitComplaint();
    if (!context.mounted) return;
    if (failure != null) {
      showFailureSnackBar(context, failure);
    } else {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(context.l10n.maintenanceComplaintSent)));
    }
  }
}

// ─── attachments section ──────────────────────────────────────────────────────
class _AttachmentsSection extends StatelessWidget {
  const _AttachmentsSection({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return BlocListener<DocumentDownloadCubit, DocumentDownloadState>(
      listenWhen: (a, b) => a.failure != b.failure && b.failure != null,
      listener: (context, state) => showFailureSnackBar(context, state.failure!),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Container(
          color: context.appColors.surface,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                decoration: BoxDecoration(
                  border: Border(bottom: BorderSide(color: context.appColors.hairline)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: _navyCard,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.attach_file_rounded, color: Colors.white, size: 18),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      l10n.maintenanceAttachmentsTitle,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: context.appColors.inkStrong,
                      ),
                    ),
                  ],
                ),
              ),
              BlocBuilder<DocumentsListCubit, DocumentsListState>(
                builder: (context, state) => switch (state.status) {
                  DataStatus.initial || DataStatus.loading => const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                    ),
                  DataStatus.failure => Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline_rounded,
                              color: Color(0xFFEF4444), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              l10n.maintenanceNoAttachments,
                              style: const TextStyle(
                                  color: Color(0xFFEF4444), fontSize: 14),
                            ),
                          ),
                          TextButton(
                            onPressed: () => context.read<DocumentsListCubit>().load(),
                            child: Text(context.l10n.actionRetry),
                          ),
                        ],
                      ),
                    ),
                  DataStatus.empty => Padding(
                      padding: const EdgeInsets.all(20),
                      child: Center(
                        child: Text(
                          l10n.maintenanceNoAttachments,
                          style: TextStyle(
                              color: context.appColors.inkMuted, fontSize: 14),
                        ),
                      ),
                    ),
                  DataStatus.success => Column(
                      children: [
                        for (final doc in state.data!) _AttachmentTile(document: doc),
                        const SizedBox(height: 4),
                      ],
                    ),
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AttachmentTile extends StatelessWidget {
  const _AttachmentTile({required this.document});

  final CustomerDocument document;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<DocumentDownloadCubit, DocumentDownloadState>(
      buildWhen: (a, b) =>
          (a.downloadingId == document.id) != (b.downloadingId == document.id),
      builder: (context, state) {
        final downloading = state.downloadingId == document.id;
        return InkWell(
          onTap: downloading
              ? null
              : () => context.read<DocumentDownloadCubit>().open(document.id),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: context.appColors.hairline)),
            ),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: document.isPdf
                        ? const Color(0xFFEF4444).withValues(alpha: 0.10)
                        : _navyCard.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    document.isPdf
                        ? Icons.picture_as_pdf_rounded
                        : Icons.insert_drive_file_outlined,
                    color: document.isPdf
                        ? const Color(0xFFEF4444)
                        : const Color(0xFF6B7280),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        document.title.isNotEmpty
                            ? document.title
                            : (document.fileName ?? ''),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: context.appColors.inkStrong,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (document.fileName != null &&
                          document.fileName != document.title)
                        Text(
                          document.fileName!,
                          style: TextStyle(
                              fontSize: 12, color: context.appColors.inkMuted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (downloading)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  Icon(Icons.download_rounded,
                      color: context.appColors.inkMuted, size: 20),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─── shared small widgets ─────────────────────────────────────────────────────
class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});

  final String label;
  final Color  color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String   label;
  final String   value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: _navyCard,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: Colors.white.withValues(alpha: 0.85), size: 17),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: context.appColors.inkMuted,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: context.appColors.inkStrong,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── dot texture (mirrors list screen) ───────────────────────────────────────
class _StarsReadOnly extends StatelessWidget {
  const _StarsReadOnly({required this.value});
  final int value;

  @override
  Widget build(BuildContext context) {
    final gold = context.appColors.brandGold;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(
        5,
        (i) => Icon(
          i < value ? Icons.star_rounded : Icons.star_border_rounded,
          color: gold,
          size: 22,
        ),
      ),
    );
  }
}

// ─── _ConfirmResolutionForm ───────────────────────────────────────────────────
class _ConfirmResolutionForm extends StatefulWidget {
  const _ConfirmResolutionForm({required this.submitting});
  final bool submitting;

  @override
  State<_ConfirmResolutionForm> createState() => _ConfirmResolutionFormState();
}

class _ConfirmResolutionFormState extends State<_ConfirmResolutionForm> {
  int _rating = 0;
  final _note = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating < 1) {
      setState(() => _error = context.l10n.maintenanceRatingRequired);
      return;
    }
    setState(() => _error = null);
    final text = _note.text.trim();
    final failure = await context.read<MaintenanceDetailCubit>().confirmResolution(
          rating: _rating,
          note: text.isEmpty ? null : text,
        );
    if (!mounted) return;
    if (failure != null) {
      showFailureSnackBar(context, failure);
    } else {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
            SnackBar(content: Text(context.l10n.maintenanceRatingThanks)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final gold  = context.appColors.brandGold;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(context.l10n.maintenanceConfirmPrompt,
            style: theme.textTheme.titleSmall),
        const SizedBox(height: AppSpacing.sm),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(5, (i) {
            final n = i + 1;
            return IconButton(
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
              onPressed: widget.submitting ? null : () => setState(() => _rating = n),
              icon: Icon(
                n <= _rating ? Icons.star_rounded : Icons.star_border_rounded,
                color: gold,
                size: 32,
              ),
            );
          }),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppTextField(
          controller: _note,
          hint: context.l10n.maintenanceRatingNoteHint,
          maxLines: 3,
          enabled: !widget.submitting,
        ),
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            _error!,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: context.appColors.error),
          ),
        ],
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: context.l10n.maintenanceConfirmAndRate,
          size: AppButtonSize.medium,
          isLoading: widget.submitting,
          onPressed: widget.submitting ? null : _submit,
        ),
      ],
    );
  }
}
