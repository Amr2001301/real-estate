import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../documents/presentation/widgets/documents_list_view.dart';
import '../domain/entities/maintenance_request.dart';
import 'maintenance_detail_cubit.dart';
import 'maintenance_format.dart';

/// Maintenance request detail: status, priority, description, the resolution
/// loop (SLA/overdue, complaint, confirm + rating), and the customer-visible
/// photos/documents. The request lives in [MaintenanceDetailCubit] (seeded from
/// the list) so confirm/complaint actions refresh it in place. Strings for the
/// resolution section are inline Arabic (Arabic-first app); existing labels use
/// l10n.
class MaintenanceRequestDetailScreen extends StatelessWidget {
  const MaintenanceRequestDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.maintenanceDetailTitle)),
      body: BlocBuilder<MaintenanceDetailCubit, MaintenanceDetailState>(
        builder: (context, state) {
          final request = state.request;
          final category = request.categoryName?.resolve(lang);

          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              AppCard(
                elevation: AppCardElevation.soft,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      children: [
                        StatusBadge(
                          label: maintenanceStatusLabel(l10n, request.status),
                          tone: maintenanceStatusTone(request.status),
                          dot: true,
                        ),
                        StatusBadge(
                          label: maintenancePriorityLabel(l10n, request.priority),
                          tone: maintenancePriorityTone(request.priority),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (category?.isNotEmpty == true) ...[
                      Text(category!, style: theme.textTheme.titleMedium),
                      const SizedBox(height: AppSpacing.xs),
                    ],
                    Text(request.description, style: theme.textTheme.bodyMedium),
                    if (request.unitCode != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        '${l10n.maintenanceUnit}: ${request.unitCode}',
                        style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                      ),
                    ],
                    if (request.createdAt != null) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        DateFormatter.mediumDate(request.createdAt!, languageCode: lang),
                        style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted),
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: AppSpacing.lg),
              _ResolutionCard(request: request, submitting: state.submitting),

              const SizedBox(height: AppSpacing.lg),
              Text(l10n.maintenanceAttachmentsTitle, style: theme.textTheme.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              DocumentsListView(emptyMessage: l10n.maintenanceNoAttachments),
            ],
          );
        },
      ),
    );
  }
}

/// SLA/overdue/unresolved + resolvedBy + complaint + confirm-resolution rating.
class _ResolutionCard extends StatelessWidget {
  const _ResolutionCard({required this.request, required this.submitting});

  final MaintenanceRequest request;
  final bool submitting;

  String _date(BuildContext context, DateTime? d) => d == null
      ? '—'
      : DateFormatter.mediumDate(d, languageCode: Localizations.localeOf(context).languageCode);

  ({String label, BadgeTone tone}) _resolvedBy() {
    switch (request.resolvedBy) {
      case MaintenanceResolvedBy.both:
        return (label: 'أكد الطرفان الحل', tone: BadgeTone.success);
      case MaintenanceResolvedBy.customer:
        return (label: 'أكد العميل الحل', tone: BadgeTone.gold);
      case MaintenanceResolvedBy.supervisor:
        return (label: 'أكد مشرف الصيانة الحل', tone: BadgeTone.gold);
      case null:
        return (label: 'لم يتم التأكيد بعد', tone: BadgeTone.neutral);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = context.appColors;
    final rb = _resolvedBy();

    return AppCard(
      elevation: AppCardElevation.soft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('متابعة الحل والتقييم', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            children: [
              StatusBadge(label: rb.label, tone: rb.tone),
              if (request.isOverdue)
                const StatusBadge(label: 'متأخر عن الموعد', tone: BadgeTone.error),
              if (request.unresolvedAt != null)
                const StatusBadge(label: 'لم تُحل', tone: BadgeTone.error),
              if (request.complaintAt != null)
                const StatusBadge(label: 'تم تقديم شكوى', tone: BadgeTone.warning),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _row(theme, colors, 'الموعد المستهدف للمعالجة',
              request.dueAt != null ? _date(context, request.dueAt) : 'يبدأ بعد اعتماد الطلب'),
          _row(theme, colors, 'تأكيد مشرف الصيانة',
              request.supervisorConfirmedResolutionAt != null
                  ? _date(context, request.supervisorConfirmedResolutionAt)
                  : 'لم يؤكد بعد'),
          if (request.complaintAt != null)
            _row(theme, colors, 'تاريخ الشكوى', _date(context, request.complaintAt)),

          // Complaint action.
          if (request.canComplain) ...[
            const SizedBox(height: AppSpacing.md),
            Text('تجاوز طلبك الموعد المستهدف — يمكنك تقديم شكوى.',
                style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: 'تقديم شكوى',
              variant: AppButtonVariant.outline,
              size: AppButtonSize.medium,
              isLoading: submitting,
              onPressed: submitting ? null : () => _complain(context),
            ),
          ],

          // Confirm resolution OR read-only rating.
          if (request.customerHasConfirmed) ...[
            const Divider(height: AppSpacing.xl),
            Text('تقييمك للخدمة', style: theme.textTheme.titleSmall),
            const SizedBox(height: AppSpacing.xs),
            _StarsReadOnly(value: request.customerRating ?? 0),
            if (request.customerRatingText?.isNotEmpty == true) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(request.customerRatingText!, style: theme.textTheme.bodyMedium),
            ],
            const SizedBox(height: AppSpacing.xxs),
            Text('أكدت الحل في ${_date(context, request.customerConfirmedResolutionAt)}',
                style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
          ] else if (request.canConfirmResolution) ...[
            const Divider(height: AppSpacing.xl),
            _ConfirmResolutionForm(submitting: submitting),
          ],
        ],
      ),
    );
  }

  Widget _row(ThemeData theme, AppColorsExt colors, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(label, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(value, style: theme.textTheme.bodySmall),
        ],
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

/// Star picker + optional note + submit. Calls the cubit; on success the cubit
/// emits the updated request and this form is replaced by the read-only view.
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
    final failure = await context
        .read<MaintenanceDetailCubit>()
        .confirmResolution(rating: _rating, note: text.isEmpty ? null : text);
    if (!mounted) return;
    if (failure != null) {
      showFailureSnackBar(context, failure);
    } else {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('شكراً لك! تم تأكيد الحل وإرسال تقييمك.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final gold = context.appColors.brandGold;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('هل تم حل المشكلة؟ أكّد الحل وقيّم الخدمة', style: theme.textTheme.titleSmall),
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
          Text(_error!, style: theme.textTheme.bodySmall?.copyWith(color: context.appColors.error)),
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
