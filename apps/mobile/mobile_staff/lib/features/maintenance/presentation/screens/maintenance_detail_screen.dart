import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/maintenance_request.dart';
import '../cubit/maintenance_detail_cubit.dart';
import '../maintenance_format.dart';

/// Supervisor maintenance detail: info, SLA/overdue, status transitions,
/// explicit resolution confirmation, the customer's confirmation/rating, and
/// read-only attachments. Write actions go through [MaintenanceDetailCubit];
/// the backend stays authoritative for valid transitions/permissions.
class MaintenanceDetailScreen extends StatefulWidget {
  const MaintenanceDetailScreen({super.key, this.fallback});
  final MaintenanceRequest? fallback;

  @override
  State<MaintenanceDetailScreen> createState() => _MaintenanceDetailScreenState();
}

class _MaintenanceDetailScreenState extends State<MaintenanceDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<MaintenanceDetailCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final title = widget.fallback?.categoryName?.resolve(Localizations.localeOf(context).languageCode);
    return Scaffold(
      appBar: AppBar(title: Text(title?.isNotEmpty == true ? title! : l10n.maintenanceFallbackTitle)),
      body: BlocConsumer<MaintenanceDetailCubit, MaintenanceDetailState>(
        listenWhen: (a, b) => a.actionFailure != b.actionFailure && b.actionFailure != null,
        listener: (context, state) => showFailureSnackBar(context, state.actionFailure!),
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const Center(child: CircularProgressIndicator());
            case DataStatus.failure:
              return ErrorState(
                failure: state.failure,
                onRetry: () => context.read<MaintenanceDetailCubit>().load(),
              );
            case DataStatus.empty:
            case DataStatus.success:
              return _body(context, state);
          }
        },
      ),
    );
  }

  Widget _body(BuildContext context, MaintenanceDetailState state) {
    final theme = Theme.of(context);
    final colors = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final detail = state.detail!;
    final r = detail.request;
    final category = r.categoryName?.resolve(lang);

    String date(DateTime? d) => d == null ? '—' : DateFormatter.mediumDate(d, languageCode: lang);

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        // ── Overview ──────────────────────────────────────────────────────
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
                    label: maintenanceStatusLabel(r.status),
                    tone: maintenanceStatusTone(r.status),
                    dot: true,
                  ),
                  StatusBadge(
                    label: maintenancePriorityLabel(r.priority),
                    tone: maintenancePriorityTone(r.priority),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              if (category?.isNotEmpty == true) ...[
                Text(category!, style: theme.textTheme.titleMedium),
                const SizedBox(height: AppSpacing.xs),
              ],
              Text(r.description, style: theme.textTheme.bodyMedium),
              const SizedBox(height: AppSpacing.sm),
              if (r.customerName != null)
                Text('العميل: ${r.customerName}',
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              if (r.customerPhone != null)
                Text('الهاتف: ${r.customerPhone}',
                    textDirection: TextDirection.ltr,
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              if (r.unitCode != null)
                Text('الوحدة: ${r.unitCode}',
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
            ],
          ),
        ),

        // ── SLA ───────────────────────────────────────────────────────────
        const SizedBox(height: AppSpacing.md),
        AppCard(
          elevation: AppCardElevation.soft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('المهلة والمتابعة', style: theme.textTheme.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.xs,
                children: [
                  StatusBadge(
                    label: maintenanceResolvedByLabel(r.resolvedBy),
                    tone: maintenanceResolvedByTone(r.resolvedBy),
                  ),
                  if (r.isOverdue) const StatusBadge(label: 'متأخر عن الموعد', tone: BadgeTone.error),
                  if (r.unresolvedAt != null) const StatusBadge(label: 'لم تُحل', tone: BadgeTone.error),
                  if (r.complaintAt != null)
                    const StatusBadge(label: 'تم تقديم شكوى', tone: BadgeTone.warning),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              _kv(theme, colors, 'الموعد المستهدف', r.dueAt != null ? date(r.dueAt) : '—'),
              _kv(theme, colors, 'تاريخ الإسناد', date(r.assignedAt)),
              if (r.complaintAt != null) _kv(theme, colors, 'تاريخ الشكوى', date(r.complaintAt)),
            ],
          ),
        ),

        // ── Status actions ─────────────────────────────────────────────────
        if (r.allowedTransitions.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text('تحديث الحالة', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final t in r.allowedTransitions)
                AppButton(
                  label: maintenanceTransitionLabel(t),
                  size: AppButtonSize.medium,
                  variant: t == MaintenanceTransition.resolve
                      ? AppButtonVariant.gold
                      : AppButtonVariant.outline,
                  onPressed: state.working
                      ? null
                      : () => context.read<MaintenanceDetailCubit>().applyTransition(t),
                ),
            ],
          ),
        ],

        // ── Supervisor confirmation ────────────────────────────────────────
        const SizedBox(height: AppSpacing.md),
        AppCard(
          elevation: AppCardElevation.soft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('تأكيد المشرف للحل', style: theme.textTheme.titleSmall),
              const SizedBox(height: AppSpacing.xs),
              if (r.supervisorHasConfirmed)
                Text('أكدت الحل في ${date(r.supervisorConfirmedResolutionAt)}',
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted))
              else if (r.canSupervisorConfirm) ...[
                Text('بعد إتمام الإصلاح، أكّد حل المشكلة.',
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
                const SizedBox(height: AppSpacing.sm),
                AppButton(
                  label: 'تأكيد حل المشكلة',
                  size: AppButtonSize.medium,
                  isLoading: state.working,
                  onPressed: state.working
                      ? null
                      : () => context.read<MaintenanceDetailCubit>().confirmResolution(),
                ),
              ] else
                Text('يتاح التأكيد بعد وضع الطلب كمُنجز.',
                    style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
            ],
          ),
        ),

        // ── Customer feedback (read-only) ──────────────────────────────────
        if (r.customerConfirmedResolutionAt != null || r.customerRating != null) ...[
          const SizedBox(height: AppSpacing.md),
          AppCard(
            elevation: AppCardElevation.soft,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('تقييم العميل', style: theme.textTheme.titleSmall),
                const SizedBox(height: AppSpacing.xs),
                if (r.customerRating != null) _Stars(value: r.customerRating!),
                if (r.customerRatingText?.isNotEmpty == true) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(r.customerRatingText!, style: theme.textTheme.bodyMedium),
                ],
                if (r.customerConfirmedResolutionAt != null) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Text('أكد العميل الحل في ${date(r.customerConfirmedResolutionAt)}',
                      style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
                ],
              ],
            ),
          ),
        ],

        // ── Attachments (read-only) ────────────────────────────────────────
        if (detail.documents.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text('المرفقات', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          for (final d in detail.documents)
            AppCard(
              child: Row(
                children: [
                  Icon(Icons.attach_file_rounded, size: 18, color: colors.inkMuted),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(d.title ?? d.fileName ?? 'مرفق',
                        style: theme.textTheme.bodyMedium),
                  ),
                ],
              ),
            ),
        ],
      ],
    );
  }

  Widget _kv(ThemeData theme, AppColorsExt colors, String label, String value) {
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
}

class _Stars extends StatelessWidget {
  const _Stars({required this.value});
  final int value;

  @override
  Widget build(BuildContext context) {
    final gold = context.appColors.brandGold;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(
        5,
        (i) => Icon(i < value ? Icons.star_rounded : Icons.star_border_rounded, color: gold, size: 22),
      ),
    );
  }
}
