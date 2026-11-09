import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/chat_entities.dart';
import '../chat_bloc.dart';
import '../chat_event.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Chat bubble
// ─────────────────────────────────────────────────────────────────────────────

/// A chat message bubble, as the staff app's assistant draws it: the
/// customer's words in a navy bubble on the reading side, the assistant's
/// answers in a card across, headed by a gold sparkle and its name. Result
/// cards and CTAs appear beneath assistant turns.
class ChatBubble extends StatelessWidget {
  const ChatBubble({super.key, required this.message});
  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    final user = message.isUser;
    final maxW = MediaQuery.sizeOf(context).width * (user ? 0.8 : 0.9);
    final bubble = Container(
      constraints: BoxConstraints(maxWidth: maxW),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: user ? AppPalette.navy : c.surface,
        border: user ? null : Border.all(color: c.hairline),
        borderRadius: BorderRadiusDirectional.only(
          topStart: const Radius.circular(18),
          topEnd: const Radius.circular(18),
          bottomStart: Radius.circular(user ? 4 : 18),
          bottomEnd: Radius.circular(user ? 18 : 4),
        ).resolve(Directionality.of(context)),
        boxShadow: user ? null : c.shadowSoft,
      ),
      child: user
          ? Text(message.content, style: const TextStyle(fontSize: 14, height: 1.5, color: Colors.white))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(children: [
                  Icon(Icons.auto_awesome_rounded, size: 14, color: AppPalette.gold500),
                  const SizedBox(width: 4),
                  Text(context.l10n.chatTitle, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppPalette.gold600)),
                ]),
                const SizedBox(height: 4),
                Text(message.content, style: TextStyle(fontSize: 14, height: 1.55, color: c.inkStrong)),
              ],
            ),
    );

    return Column(
      crossAxisAlignment: user ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Align(
          // The customer's words on the reading side, the answers across.
          alignment: user ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
          child: bubble,
        ),
        // Attached result cards
        if (message.cards.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          for (final card in message.cards)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: _ChatResultCard(card: card),
            ),
        ],
        // CTA action chips
        if (message.ctas.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
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

// ─────────────────────────────────────────────────────────────────────────────
// Result card
// ─────────────────────────────────────────────────────────────────────────────

class _ChatResultCard extends StatelessWidget {
  const _ChatResultCard({required this.card});
  final ChatCard card;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final dir = Directionality.of(context);

    final imageRadius = BorderRadiusDirectional.only(
      topStart: const Radius.circular(AppRadii.lg),
      bottomStart: const Radius.circular(AppRadii.lg),
    ).resolve(dir);

    return SizedBox(
      width: 304,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _open(context, card.href),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          child: Container(
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(AppRadii.lg),
              border: Border.all(
                  color: colors.hairline.withValues(alpha: 0.6)),
              boxShadow: colors.shadowSoft,
            ),
            child: Row(
              children: [
                // Image panel
                ClipRRect(
                  borderRadius: imageRadius,
                  child: SizedBox(
                    width: 80,
                    height: 80,
                    child: AppNetworkImage(url: card.imageUrl),
                  ),
                ),
                // Details
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          card.title,
                          style: theme.textTheme.titleSmall?.copyWith(
                            color: colors.inkStrong,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (card.subtitle != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            card.subtitle!,
                            style: theme.textTheme.bodySmall
                                ?.copyWith(color: colors.inkMuted),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                        if (card.price != null) ...[
                          const SizedBox(height: AppSpacing.xxs + 2),
                          Text(
                            card.price!,
                            style: theme.textTheme.labelLarge?.copyWith(
                              color: colors.brandGold,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                // Chevron
                Padding(
                  padding:
                      const EdgeInsetsDirectional.only(end: AppSpacing.xs),
                  child: Icon(AppIcons.chevronForward,
                      size: 16, color: colors.inkMuted),
                ),
              ],
            ),
          ),
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

// ─────────────────────────────────────────────────────────────────────────────
// CTA chip
// ─────────────────────────────────────────────────────────────────────────────

class _CtaChip extends StatelessWidget {
  const _CtaChip({required this.cta});
  final ChatCta cta;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _onTap(context),
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm + 2, vertical: AppSpacing.xs + 2),
          decoration: BoxDecoration(
            color: AppPalette.navy.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(AppRadii.md),
            border: Border.all(
              color: AppPalette.gold400.withValues(alpha: 0.35),
              width: 0.6,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(_icon, size: 14, color: AppPalette.gold300),
              const SizedBox(width: AppSpacing.xxs + 2),
              Text(
                cta.label,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
      ),
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
        context.read<ChatBloc>().add(ChatMessageSent(cta.label));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick replies
// ─────────────────────────────────────────────────────────────────────────────

/// A horizontal strip of gold-outlined quick-reply pills. Tapping sends the
/// pill text as the next message.
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
        itemBuilder: (context, i) => _QuickReplyPill(
          label: replies[i],
          onTap: () =>
              context.read<ChatBloc>().add(ChatMessageSent(replies[i])),
        ),
      ),
    );
  }
}

class _QuickReplyPill extends StatelessWidget {
  const _QuickReplyPill({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.pillAll,
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md, vertical: AppSpacing.xs),
          decoration: BoxDecoration(
            color: colors.brandGoldSoft,
            borderRadius: AppRadii.pillAll,
            border: Border.all(
              color: colors.brandGold.withValues(alpha: 0.55),
              width: 0.8,
            ),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: colors.brandGold,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.1,
                ),
          ),
        ),
      ),
    );
  }
}

/// What the assistant offers to start with, as cards (the staff app's look).
class ChatSuggestions extends StatelessWidget {
  const ChatSuggestions({super.key, required this.replies});
  final List<String> replies;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    return Column(children: [
      for (final r in replies)
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
          child: Material(
            color: c.surface,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              onTap: () => context.read<ChatBloc>().add(ChatMessageSent(r)),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 12),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: c.hairline)),
                child: Row(children: [
                  Icon(Icons.chat_bubble_rounded, size: 18, color: AppPalette.gold600),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(child: Text(r, style: TextStyle(fontSize: 14, color: c.ink))),
                  Icon(Icons.north_west_rounded, size: 16, color: c.inkMuted),
                ]),
              ),
            ),
          ),
        ),
    ]);
  }
}
