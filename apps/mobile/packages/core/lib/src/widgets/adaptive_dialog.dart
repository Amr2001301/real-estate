import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../design/platform/app_platform.dart';

/// Shows a confirmation dialog that is Cupertino-styled on iOS/macOS and
/// Material-styled on Android (via [showAdaptiveDialog] + [AlertDialog.adaptive]
/// with platform-appropriate actions). Returns true if confirmed, false if
/// dismissed/cancelled.
Future<bool> showAdaptiveConfirm(
  BuildContext context, {
  required String title,
  required String confirmLabel,
  required String cancelLabel,
  String? message,
  bool destructive = false,
}) async {
  final confirmed = await showAdaptiveDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog.adaptive(
      title: Text(title),
      content: message != null ? Text(message) : null,
      actions: [
        _adaptiveAction(dialogContext, label: cancelLabel, value: false),
        _adaptiveAction(
          dialogContext,
          label: confirmLabel,
          value: true,
          destructive: destructive,
          isDefault: !destructive,
        ),
      ],
    ),
  );
  return confirmed ?? false;
}

Widget _adaptiveAction(
  BuildContext context, {
  required String label,
  required bool value,
  bool destructive = false,
  bool isDefault = false,
}) {
  void close() => Navigator.of(context).pop(value);

  if (context.isApplePlatform) {
    return CupertinoDialogAction(
      onPressed: close,
      isDestructiveAction: destructive,
      isDefaultAction: isDefault,
      child: Text(label),
    );
  }
  return TextButton(onPressed: close, child: Text(label));
}
