import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/repositories/visits_repository.dart';
import 'visit_request_cubit.dart';

/// Form to request a visit for a project (and optional unit). Authenticated.
class VisitRequestScreen extends StatefulWidget {
  const VisitRequestScreen({super.key, required this.projectId, this.unitId});

  final String projectId;
  final String? unitId;

  @override
  State<VisitRequestScreen> createState() => _VisitRequestScreenState();
}

class _VisitRequestScreenState extends State<VisitRequestScreen> {
  DateTime? _date;
  final _notes = TextEditingController();
  bool _dateError = false;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 120)),
      initialDate: now.add(const Duration(days: 1)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  void _submit() {
    if (_date == null) {
      setState(() => _dateError = true);
      return;
    }
    context.read<VisitRequestCubit>().submit(CreateVisitParams(
          projectId: widget.projectId,
          unitId: widget.unitId,
          preferredDate: _date!,
          notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        ));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final dateLabel = _date == null
        ? l10n.selectDate
        : DateFormatter.mediumDate(_date!, languageCode: lang);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.visitRequestTitle)),
      body: BlocConsumer<VisitRequestCubit, VisitFormState>(
        listener: (context, state) {
          if (state.status == VisitFormStatus.success) {
            Navigator.of(context).pop();
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(l10n.visitSubmitted)));
          } else if (state.status == VisitFormStatus.failure &&
              state.failure != null) {
            showFailureSnackBar(context, state.failure!);
          }
        },
        builder: (context, state) {
          return ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              Text(l10n.fieldPreferredDate,
                  style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: AppSpacing.xs),
              AppCard(
                onTap: _pickDate,
                child: Row(
                  children: [
                    Icon(Icons.calendar_today_rounded,
                        color: context.appColors.brandGold, size: 20),
                    const SizedBox(width: AppSpacing.sm),
                    Text(dateLabel, style: Theme.of(context).textTheme.bodyLarge),
                  ],
                ),
              ),
              if (_dateError)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xs),
                  child: Text(l10n.validationRequired,
                      style: TextStyle(color: context.appColors.error)),
                ),
              const SizedBox(height: AppSpacing.lg),
              TextField(
                controller: _notes,
                maxLines: 3,
                decoration: InputDecoration(labelText: l10n.fieldNotes),
              ),
              const SizedBox(height: AppSpacing.xl),
              AppButton(
                label: l10n.visitSubmit,
                expand: true,
                isLoading: state.isSubmitting,
                onPressed: _submit,
              ),
            ],
          );
        },
      ),
    );
  }
}
