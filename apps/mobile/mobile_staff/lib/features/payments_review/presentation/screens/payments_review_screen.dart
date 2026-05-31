import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../common/staff_list_skeleton.dart';
import '../../domain/entities/payment_review_item.dart';
import '../cubit/payments_review_cubit.dart';
import '../widgets/payment_review_tile.dart';

/// Staff payment-proof review queue (مراجعة المدفوعات).
///
/// Viewable by ADMIN + SALES_MANAGER (mirrors `GET /deposits/review-queue`).
/// Approve/reject are ADMIN-only on the backend (`@PermissionsStrict
/// deposits:verify`), so the action buttons render only when [canReview] is
/// true; SALES_MANAGER sees a read-only queue. A direct 403 still surfaces as a
/// friendly forbidden state.
class PaymentsReviewScreen extends StatefulWidget {
  const PaymentsReviewScreen({super.key});

  @override
  State<PaymentsReviewScreen> createState() => _PaymentsReviewScreenState();
}

class _PaymentsReviewScreenState extends State<PaymentsReviewScreen> {
  @override
  void initState() {
    super.initState();
    context.read<PaymentsReviewCubit>().load();
  }

  bool get _canReview => context.read<SessionCubit>().state.role == AppRole.admin;

  Future<void> _approve(PaymentReviewItem item) async {
    await context.read<PaymentsReviewCubit>().approve(item.id);
  }

  Future<void> _reject(PaymentReviewItem item) async {
    final reason = await _askReason();
    if (reason == null || !mounted) return; // dismissed or unmounted
    await context.read<PaymentsReviewCubit>().reject(item.id, reason);
  }

  /// Collect a required, non-empty rejection reason (backend caps it at 2000).
  Future<String?> _askReason() async {
    final l10n = context.l10n;
    final controller = TextEditingController();
    final formKey = GlobalKey<FormState>();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.paymentRejectReason),
        content: Form(
          key: formKey,
          child: TextFormField(
            controller: controller,
            autofocus: true,
            maxLength: 2000,
            maxLines: 3,
            decoration: InputDecoration(hintText: l10n.paymentRejectReason),
            validator: (v) => (v == null || v.trim().isEmpty) ? l10n.paymentReasonRequired : null,
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(l10n.actionCancel)),
          TextButton(
            onPressed: () {
              if (formKey.currentState?.validate() ?? false) {
                Navigator.pop(ctx, controller.text.trim());
              }
            },
            child: Text(l10n.paymentReject),
          ),
        ],
      ),
    );
    controller.dispose();
    return reason;
  }

  void _onAction(BuildContext context, PaymentsReviewState state) {
    final l10n = context.l10n;
    if (state.actionFailure != null) {
      showFailureSnackBar(context, state.actionFailure!);
      return;
    }
    if (state.lastDecision != null) {
      final message = state.lastDecision == ReviewDecision.approved ? l10n.paymentApproved : l10n.paymentRejected;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<PaymentsReviewCubit>();
    final canReview = _canReview;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.paymentReviewTitle)),
      body: BlocConsumer<PaymentsReviewCubit, PaymentsReviewState>(
        listenWhen: (a, b) => a.actionEpoch != b.actionEpoch,
        listener: _onAction,
        builder: (context, state) {
          switch (state.status) {
            case DataStatus.initial:
            case DataStatus.loading:
              return const StaffListSkeleton();
            case DataStatus.failure:
              return ErrorState(failure: state.failure, onRetry: cubit.load);
            case DataStatus.empty:
              return EmptyState(
                icon: Icons.receipt_long_outlined,
                title: l10n.paymentReviewEmptyTitle,
                message: l10n.paymentReviewEmptyMessage,
              );
            case DataStatus.success:
              return RefreshIndicator(
                onRefresh: cubit.load,
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: state.items.length + (canReview ? 0 : 1),
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, i) {
                    if (!canReview && i == 0) return const _ReadOnlyBanner();
                    final item = state.items[canReview ? i : i - 1];
                    return PaymentReviewTile(
                      item: item,
                      canReview: canReview,
                      busy: state.workingId == item.id,
                      onApprove: () => _approve(item),
                      onReject: () => _reject(item),
                    );
                  },
                ),
              );
          }
        },
      ),
    );
  }
}

/// Shown to SALES_MANAGER, who can view the queue but not approve/reject.
class _ReadOnlyBanner extends StatelessWidget {
  const _ReadOnlyBanner();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return AppCard(
      elevation: AppCardElevation.none,
      child: Row(
        children: [
          Icon(Icons.info_outline_rounded, size: 18, color: colors.inkMuted),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              l10n.paymentReviewReadOnly,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted),
            ),
          ),
        ],
      ),
    );
  }
}
