import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/record_deposit_cubit.dart';

/// Arguments passed via GoRouter `extra`:
/// ```dart
/// context.push('/deposits/record', extra: {
///   'contractId': '...',
///   'installmentId': '...',
///   'amount': 50000.0,
///   'label': 'Down payment · 2024-01-15',
/// });
/// ```
class RecordDepositScreen extends StatefulWidget {
  const RecordDepositScreen({
    super.key,
    required this.contractId,
    required this.installmentId,
    required this.suggestedAmount,
    this.installmentLabel,
  });

  final String contractId;
  final String installmentId;
  final double suggestedAmount;
  final String? installmentLabel;

  @override
  State<RecordDepositScreen> createState() => _RecordDepositScreenState();
}

class _RecordDepositScreenState extends State<RecordDepositScreen> {
  final _amountCtrl = TextEditingController();
  DateTime _paidAt = DateTime.now();
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _amountCtrl.text = widget.suggestedAmount > 0
        ? widget.suggestedAmount.toStringAsFixed(0)
        : '';
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _paidAt,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _paidAt = picked);
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    final amount = double.tryParse(_amountCtrl.text.replaceAll(',', ''));
    if (amount == null) return;
    context.read<RecordDepositCubit>().submit(
          contractId: widget.contractId,
          installmentId: widget.installmentId,
          amount: amount,
          paidAt: _paidAt,
        );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BlocListener<RecordDepositCubit, RecordDepositState>(
      listenWhen: (a, b) => a.status != b.status,
      listener: (context, state) {
        if (state.status == RecordDepositStatus.success) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(l10n.depositRecordSuccess)),
          );
          context.pop(true);
        } else if (state.status == RecordDepositStatus.failure &&
            state.failure != null) {
          showFailureSnackBar(context, state.failure!);
        }
      },
      child: Scaffold(
        body: Builder(
          builder: (context) {
            return Column(
              children: [
                AppNavHeader(
                  title: l10n.recordDeposit,
                  leadingAction: NavHeaderAction(
                    icon: Icons.arrow_back_ios_new_rounded,
                    onTap: () => context.pop(),
                  ),
                ),
                Expanded(
                  child: Form(
                    key: _formKey,
                    child: ListView(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      children: [
              if (widget.installmentLabel != null) ...[
                AppCard(
                  elevation: AppCardElevation.soft,
                  child: Text(
                    widget.installmentLabel!,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              TextFormField(
                controller: _amountCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: l10n.depositAmount,
                  border: const OutlineInputBorder(),
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return l10n.validationRequired;
                  if (double.tryParse(v.replaceAll(',', '')) == null) {
                    return l10n.validationRequired;
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.md),
              InkWell(
                onTap: _pickDate,
                child: InputDecorator(
                  decoration: InputDecoration(
                    labelText: l10n.depositPaymentDate,
                    border: const OutlineInputBorder(),
                    suffixIcon: const Icon(Icons.calendar_today_rounded),
                  ),
                  child: Text(
                    '${_paidAt.day.toString().padLeft(2, '0')}/'
                    '${_paidAt.month.toString().padLeft(2, '0')}/'
                    '${_paidAt.year}',
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              BlocBuilder<RecordDepositCubit, RecordDepositState>(
                builder: (context, state) {
                  final loading = state.status == RecordDepositStatus.submitting;
                  return FilledButton(
                    onPressed: loading ? null : _submit,
                    child: loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(l10n.recordDeposit),
                  );
                },
              ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
