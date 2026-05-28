import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Call + WhatsApp buttons for a contact's own [phone] (lead/client). Renders
/// nothing when no phone is available. Unlike the Customer app, the number is
/// the contact's — not a client-owned EnvConfig number.
class StaffContactButtons extends StatelessWidget {
  const StaffContactButtons({super.key, this.phone, this.whatsappMessage});

  final String? phone;
  final String? whatsappMessage;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final number = phone?.trim() ?? '';
    if (number.isEmpty) return const SizedBox.shrink();

    return Row(
      children: [
        Expanded(
          child: AppButton(
            label: l10n.contactCall,
            icon: Icons.call_rounded,
            variant: AppButtonVariant.outline,
            size: AppButtonSize.medium,
            onPressed: () => ContactActions.call(number),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: AppButton(
            label: l10n.contactWhatsapp,
            icon: Icons.chat_rounded,
            variant: AppButtonVariant.gold,
            size: AppButtonSize.medium,
            onPressed: () => ContactActions.whatsApp(number: number, message: whatsappMessage),
          ),
        ),
      ],
    );
  }
}
