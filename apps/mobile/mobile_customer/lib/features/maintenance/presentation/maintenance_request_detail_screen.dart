import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../documents/domain/entities/customer_document.dart';
import '../../documents/presentation/document_download_cubit.dart';
import '../../documents/presentation/documents_list_cubit.dart';
import '../domain/entities/maintenance_request.dart';
import 'maintenance_detail_cubit.dart';
import 'maintenance_format.dart';

// ─── colour palette ──────────────────────────────────────────────────────────
const _navyDeep  = Color(0xFF0B1726);
const _navyCard  = Color(0xFF1A3352);
const _navyLight = Color(0xFF243F62);

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
            backgroundColor: const Color(0xFFF5F7FA),
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
    final statusLabel = maintenanceStatusLabel(l10n, request.status);

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradient,
        ),
      ),
      child: Stack(
        children: [
          const Positioned.fill(child: _DotTexture()),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => context.pop(),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                      ),
                      child: const Icon(
                        Icons.arrow_back_ios_new_rounded,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'طلب صيانة',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.65),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'تفاصيل الطلب',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _StatusPill(label: statusLabel, color: accent),
                ],
              ),
            ),
          ),
        ],
      ),
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

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Gradient strip
          Container(
            height: 100,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: gradient,
              ),
            ),
            child: Stack(
              children: [
                const Positioned.fill(child: _DotTexture()),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  child: Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: accent.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: accent.withValues(alpha: 0.35)),
                        ),
                        child: Icon(icon, color: accent, size: 26),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              category?.isNotEmpty == true ? category! : 'طلب صيانة',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                height: 1.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (request.unitCode != null)
                              Text(
                                'وحدة ${request.unitCode}',
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.7),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // White body
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: priorityColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: priorityColor.withValues(alpha: 0.35)),
                      ),
                      child: Text(
                        priorityLabel,
                        style: TextStyle(
                          color: priorityColor,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const Spacer(),
                    if (date != null) ...[
                      Icon(
                        Icons.calendar_today_rounded,
                        size: 13,
                        color: Colors.black.withValues(alpha: 0.35),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        date,
                        style: TextStyle(
                          color: Colors.black.withValues(alpha: 0.5),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  request.description,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF1A1A2E),
                    height: 1.6,
                  ),
                  maxLines: 5,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

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

  ({String label, Color color}) _resolvedByInfo() => switch (request.resolvedBy) {
        MaintenanceResolvedBy.both =>
          (label: 'أكد الطرفان الحل', color: const Color(0xFF4ADE80)),
        MaintenanceResolvedBy.customer =>
          (label: 'أكد العميل الحل', color: AppPalette.gold300),
        MaintenanceResolvedBy.supervisor =>
          (label: 'أكد مشرف الصيانة الحل', color: AppPalette.gold300),
        null =>
          (label: 'لم يتم التأكيد بعد', color: const Color(0xFF9CA3AF)),
      };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.appColors;
    final rb = _resolvedByInfo();

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        color: Colors.white,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Card header
            Container(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: Color(0xFFF0F0F0))),
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
                  const Text(
                    'متابعة الحل والتقييم',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1A1A2E),
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
                        const _StatusPill(
                            label: 'متأخر عن الموعد', color: Color(0xFFEF4444)),
                      if (request.unresolvedAt != null)
                        const _StatusPill(label: 'لم تُحل', color: Color(0xFFEF4444)),
                      if (request.complaintAt != null)
                        const _StatusPill(
                            label: 'تم تقديم شكوى', color: Color(0xFFF97316)),
                    ],
                  ),
                  const SizedBox(height: 14),
                  // Info rows
                  _InfoRow(
                    icon: Icons.schedule_rounded,
                    label: 'الموعد المستهدف للمعالجة',
                    value: request.dueAt != null
                        ? _dateStr(context, request.dueAt)
                        : 'يبدأ بعد اعتماد الطلب',
                  ),
                  _InfoRow(
                    icon: Icons.verified_rounded,
                    label: 'تأكيد مشرف الصيانة',
                    value: request.supervisorConfirmedResolutionAt != null
                        ? _dateStr(context, request.supervisorConfirmedResolutionAt)
                        : 'لم يؤكد بعد',
                  ),
                  if (request.complaintAt != null)
                    _InfoRow(
                      icon: Icons.report_rounded,
                      label: 'تاريخ الشكوى',
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
                      'تجاوز طلبك الموعد المستهدف — يمكنك تقديم شكوى.',
                      style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                    ),
                    const SizedBox(height: 10),
                    AppButton(
                      label: 'تقديم شكوى',
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
                    const Text(
                      'تقييمك للخدمة',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1A1A2E),
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
                      'أكدت الحل في ${_dateStr(context, request.customerConfirmedResolutionAt)}',
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
        ..showSnackBar(const SnackBar(content: Text('تم تسجيل شكواك وسيتابعها فريقنا.')));
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
          color: Colors.white,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: Color(0xFFF0F0F0))),
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
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1A1A2E),
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
                            child: const Text('إعادة المحاولة'),
                          ),
                        ],
                      ),
                    ),
                  DataStatus.empty => Padding(
                      padding: const EdgeInsets.all(20),
                      child: Center(
                        child: Text(
                          l10n.maintenanceNoAttachments,
                          style: const TextStyle(
                              color: Color(0xFF9CA3AF), fontSize: 14),
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
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFFF0F0F0))),
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
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1A1A2E),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (document.fileName != null &&
                          document.fileName != document.title)
                        Text(
                          document.fileName!,
                          style: const TextStyle(
                              fontSize: 11, color: Color(0xFF9CA3AF)),
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
                  const Icon(Icons.download_rounded,
                      color: Color(0xFF9CA3AF), size: 20),
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
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1A1A2E),
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
class _DotTexture extends StatelessWidget {
  const _DotTexture();

  @override
  Widget build(BuildContext context) => CustomPaint(painter: _DotPainter());
}

class _DotPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..style = PaintingStyle.fill;
    const step = 18.0;
    for (double x = 0; x < size.width; x += step) {
      for (double y = 0; y < size.height; y += step) {
        canvas.drawCircle(Offset(x, y), 1.5, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DotPainter old) => false;
}

// ─── _StarsReadOnly ───────────────────────────────────────────────────────────
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
      setState(() => _error = 'يرجى اختيار تقييم من 1 إلى 5 نجوم.');
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
            const SnackBar(content: Text('شكراً لك! تم تأكيد الحل وإرسال تقييمك.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final gold  = context.appColors.brandGold;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('هل تم حل المشكلة؟ أكّد الحل وقيّم الخدمة',
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
          hint: 'أضف ملاحظة عن جودة الخدمة (اختياري)',
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
          label: 'تأكيد الحل وإرسال التقييم',
          size: AppButtonSize.medium,
          isLoading: widget.submitting,
          onPressed: widget.submitting ? null : _submit,
        ),
      ],
    );
  }
}
