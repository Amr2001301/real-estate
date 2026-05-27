import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/chat_entities.dart';
import '../chat_bloc.dart';
import '../chat_event.dart';

/// A chat message bubble. Assistant messages also render their per-turn cards
/// and CTAs beneath the text.
class ChatBubble extends StatelessWidget {
  const ChatBubble({super.key, required this.message});
  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final isUser = message.isUser;

    final bubble = Container(
      constraints: const BoxConstraints(maxWidth: 320),
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: isUser ? colors.brandNavy : colors.surfaceSoft,
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(AppRadii.lg),
          topRight: const Radius.circular(AppRadii.lg),
          bottomLeft: Radius.circular(isUser ? AppRadii.lg : AppRadii.xs),
          bottomRight: Radius.circular(isUser ? AppRadii.xs : AppRadii.lg),
        ),
      ),
      child: Text(
        message.content,
        style: theme.textTheme.bodyMedium
            ?.copyWith(color: isUser ? Colors.white : colors.ink),
      ),
    );

    return Column(
      crossAxisAlignment:
          isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Align(
          alignment:
              isUser ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
          child: bubble,
        ),
        if (message.cards.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          for (final card in message.cards)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: _ChatResultCard(card: card),
            ),
        ],
        if (message.ctas.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xxs),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [for (final cta in message.ctas) _CtaChip(cta: cta)],
          ),
        ],
      ],
    );
  }
}

class _ChatResultCard extends StatelessWidget {
  const _ChatResultCard({required this.card});
  final ChatCard card;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return SizedBox(
      width: 320,
      child: AppCard(
        padding: const EdgeInsets.all(AppSpacing.sm),
        onTap: () => _open(context, card.href),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.sm),
              child: SizedBox(
                width: 64,
                height: 64,
                child: AppNetworkImage(url: card.imageUrl),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(card.title,
                      style: theme.textTheme.titleSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  if (card.subtitle != null)
                    Text(card.subtitle!,
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: colors.inkMuted),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                  if (card.price != null)
                    Text(card.price!,
                        style: theme.textTheme.labelLarge
                            ?.copyWith(color: colors.brandGold)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    );
  }

  void _open(BuildContext context, String href) {
    if (href.startsWith('/')) {
      context.push(href);
    } else if (href.isNotEmpty) {
      ContactActions.openExternal(href);
    }
  }
}

class _CtaChip extends StatelessWidget {
  const _CtaChip({required this.cta});
  final ChatCta cta;

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: Icon(_icon, size: 18),
      label: Text(cta.label),
      onPressed: () => _onTap(context),
    );
  }

  IconData get _icon => switch (cta.kind) {
        'whatsapp' => Icons.chat_rounded,
        'visit' => Icons.event_available_outlined,
        'info' => Icons.info_outline_rounded,
        _ => Icons.open_in_new_rounded,
      };

  void _onTap(BuildContext context) {
    switch (cta.kind) {
      case 'whatsapp':
        final number = EnvConfig.current.whatsappNumber;
        if (number.isNotEmpty) {
          ContactActions.whatsApp(number: number, message: cta.payloadMessage);
        }
      case 'link':
        final href = cta.href ?? '';
        if (href.startsWith('/')) {
          context.push(href);
        } else if (href.isNotEmpty) {
          ContactActions.openExternal(href);
        }
      default:
        // visit / info → continue the lead-capture flow by sending the label.
        context.read<ChatBloc>().add(ChatMessageSent(cta.label));
    }
  }
}

/// Quick-reply chips; tapping sends the chip text as the next message.
class QuickReplies extends StatelessWidget {
  const QuickReplies({super.key, required this.replies});
  final List<String> replies;

  @override
  Widget build(BuildContext context) {
    if (replies.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        itemCount: replies.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.xs),
        itemBuilder: (context, i) => ActionChip(
          label: Text(replies[i]),
          onPressed: () =>
              context.read<ChatBloc>().add(ChatMessageSent(replies[i])),
        ),
      ),
    );
  }
}
