import 'package:core/core.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../dashboard/home_kit/home_kit.dart';
import 'contract_create_data.dart';

/// The pieces the convert page and the manual contract share: a white card
/// of fields, a labelled field box, a date field, the document field and
/// the bottom bar (cancel, confirm).

class FormCardBox extends StatelessWidget {
  const FormCardBox({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
        decoration: homeCard(context, radius: 22),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
      );
}

class FormFieldBox extends StatelessWidget {
  const FormFieldBox({super.key, required this.label, required this.child, this.hint, this.error});
  final String label;
  final String? hint;
  final String? error;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.inkMuted)),
        const SizedBox(height: 4),
        child,
        if (error != null)
          Padding(padding: const EdgeInsets.only(top: 4), child: Text(error!, style: TextStyle(fontSize: 12, color: colors.error)))
        else if (hint != null)
          Padding(padding: const EdgeInsets.only(top: 4), child: Text(hint!, style: TextStyle(fontSize: 12, color: colors.inkMuted))),
      ]),
    );
  }
}

/// The 44-high box a field's value sits in, with its trailing icon.
class FormValueBox extends StatelessWidget {
  const FormValueBox({super.key, required this.text, required this.icon, required this.onTap, this.placeholder = false, this.onClear, this.invalid = false});
  final String text;
  final IconData icon;
  final VoidCallback? onTap;
  final bool placeholder;
  final VoidCallback? onClear;
  final bool invalid;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(13),
        side: BorderSide(color: invalid ? colors.error : colors.hairline),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(13),
        onTap: onTap,
        child: SizedBox(
          height: 46,
          child: Padding(
            padding: const EdgeInsetsDirectional.only(start: 12, end: 6),
            child: Row(children: [
              Expanded(
                child: Text(text,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13.5, color: placeholder ? const Color(0xFF9A9083) : colors.inkStrong)),
              ),
              if (onClear != null)
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 18),
                  color: colors.inkMuted,
                  visualDensity: VisualDensity.compact,
                  onPressed: onClear,
                )
              else
                Padding(padding: const EdgeInsets.symmetric(horizontal: 6), child: Icon(icon, size: 19, color: colors.inkMuted)),
            ]),
          ),
        ),
      ),
    );
  }
}

class FormDateField extends StatelessWidget {
  const FormDateField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    required this.placeholder,
    this.clearable = false,
    this.first,
    this.last,
    this.error,
    this.fieldKey,
  });
  final String label;
  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;
  final String placeholder;
  final bool clearable;
  final DateTime? first;
  final DateTime? last;
  final String? error;
  final Key? fieldKey;

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    return FormFieldBox(
      label: label,
      error: error,
      child: FormValueBox(
        key: fieldKey,
        text: value == null ? placeholder : DateFormatter.mediumDate(value!, languageCode: lang),
        placeholder: value == null,
        invalid: error != null,
        icon: Icons.calendar_today_rounded,
        onClear: clearable && value != null ? () => onChanged(null) : null,
        onTap: () async {
          final now = DateTime.now();
          final picked = await showDatePicker(
            context: context,
            initialDate: value ?? now,
            firstDate: first ?? DateTime(now.year - 30),
            lastDate: last ?? DateTime(now.year + 10),
          );
          if (picked != null) onChanged(picked);
        },
      ),
    );
  }
}

class FormDocumentField extends StatelessWidget {
  const FormDocumentField({super.key, required this.value, required this.onChanged});
  final PickedDocument? value;
  final ValueChanged<PickedDocument?> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return FormFieldBox(
      label: l10n.cvDocument,
      child: FormValueBox(
        key: const Key('contract-doc'),
        text: value == null ? l10n.cvAttach : ltr(value!.name),
        placeholder: value == null,
        icon: Icons.attach_file_rounded,
        onClear: value == null ? null : () => onChanged(null),
        onTap: () async {
          final r = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png'], withData: true);
          final f = r?.files.singleOrNull;
          final mime = f == null ? null : PickedDocument.mimeFor(f.name);
          if (f?.bytes == null || mime == null) return;
          onChanged(PickedDocument(name: f!.name, bytes: f.bytes!, mimeType: mime));
        },
      ),
    );
  }
}

class FormBottomBar extends StatelessWidget {
  const FormBottomBar({super.key, required this.label, required this.icon, required this.onConfirm, this.busy = false, this.confirmKey});
  final String label;
  final IconData icon;

  /// Null while it cannot be confirmed.
  final VoidCallback? onConfirm;
  final bool busy;
  final Key? confirmKey;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(color: colors.canvas, border: Border(top: BorderSide(color: colors.hairline))),
      child: Row(children: [
        Expanded(
          child: OutlinedButton(
            onPressed: busy ? null : () => Navigator.of(context).maybePop(),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              foregroundColor: colors.inkStrong,
              side: const BorderSide(color: AppPalette.navy, width: 1.2),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
            ),
            child: Text(l10n.cvCancel),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          flex: 2,
          child: FilledButton.icon(
            key: confirmKey,
            onPressed: busy ? null : onConfirm,
            icon: busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.navy))
                : Icon(icon, size: 19),
            label: Text(label),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              backgroundColor: AppPalette.gold400,
              foregroundColor: AppPalette.navy,
              disabledBackgroundColor: const Color(0xFFE9E3D9),
              disabledForegroundColor: const Color(0xFF9A9083),
              textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
            ),
          ),
        ),
      ]),
    );
  }
}

/// The amber notice the design uses when something blocks the action.
class FormWarning extends StatelessWidget {
  const FormWarning({super.key, required this.text, this.error = false});
  final String text;
  final bool error;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(top: 10),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: error ? const Color(0xFFF8E6E4) : const Color(0xFFFFF6E6),
          border: Border.all(color: error ? const Color(0xFFF1C9C4) : const Color(0xFFF1D9A8)),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(error ? Icons.error_rounded : Icons.warning_rounded, size: 18, color: error ? context.appColors.error : const Color(0xFF8A5A12)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(text, style: TextStyle(fontSize: 12, height: 1.45, color: error ? context.appColors.error : const Color(0xFF8A5A12))),
          ),
        ]),
      );
}
