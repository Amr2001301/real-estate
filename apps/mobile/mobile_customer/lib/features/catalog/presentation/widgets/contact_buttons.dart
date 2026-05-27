import 'package:core/core.dart';
import 'package:flutter/material.dart';

/// Call + WhatsApp action buttons. The phone/number come from `EnvConfig`
/// (client-owned); each button is hidden when its channel isn't configured, so
/// this renders nothing if no contact channel is set.
class ContactButtons extends StatelessWidget {
  const ContactButtons({super.key, this.whatsappMessage});

  /// Prefilled WhatsApp text (e.g. from a chat CTA or "interested in unit X").
  final String? whatsappMessage;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final env = EnvConfig.current;
    final hasPhone = env.contactPhone.isNotEmpty;
    final hasWhatsapp = env.whatsappNumber.isNotEmpty;
    if (!hasPhone && !hasWhatsapp) return const SizedBox.shrink();

    return Row(
      children: [
        if (hasPhone)
          Expanded(
            child: AppButton(
              label: l10n.contactCall,
              icon: Icons.call_rounded,
              variant: AppButtonVariant.outline,
              onPressed: () => ContactActions.call(env.contactPhone),
            ),
          ),
        if (hasPhone && hasWhatsapp) const SizedBox(width: AppSpacing.sm),
        if (hasWhatsapp)
          Expanded(
            child: AppButton(
              label: l10n.contactWhatsapp,
              icon: Icons.chat_rounded,
              variant: AppButtonVariant.gold,
              onPressed: () => ContactActions.whatsApp(
                number: env.whatsappNumber,
                message: whatsappMessage,
              ),
            ),
          ),
      ],
    );
  }
}
