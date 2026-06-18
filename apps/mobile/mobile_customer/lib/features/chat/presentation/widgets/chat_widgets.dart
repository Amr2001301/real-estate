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

/// A chat message bubble.
///
/// User bubbles: navy gradient with an angled shine and a bottom-end tail.
/// Assistant bubbles: white surface with a gold start-edge bar and a
/// bottom-start tail. Result cards and CTAs appear beneath assistant turns.
class ChatBubble extends StatelessWidget {
  const ChatBubble({super.key, required this.message});
  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    final isUser = message.isUser;
    final dir = Directionality.of(context);

    // Directional border radius: small corner acts as the message "tail"
    // anchored at the sender's outer-bottom corner.
    final radius = BorderRadiusDirectional.only(
      topStart: const Radius.circular(AppRadii.xl),
      topEnd: const Radius.circular(AppRadii.xl),
      bottomStart:
          Radius.circular(isUser ? AppRadii.xl : AppRadii.xs + 2),
      bottomEnd:
          Radius.circular(isUser ? AppRadii.xs + 2 : AppRadii.xl),
    ).resolve(dir);

    final bubbleContent = isUser
        ? Text(
            message.content,
            style: theme.textTheme.bodyMedium
                ?.copyWith(color: Colors.white, height: 1.55),
          )
        : _AssistantContent(message: message, theme: theme, colors: colors);

    final bubble = Container(
      constraints: const BoxConstraints(maxWidth: 304),
      padding: EdgeInsets.fromLTRB(
        isUser ? AppSpacing.md : AppSpacing.xs,
        AppSpacing.sm + 2,
        AppSpacing.md,
        AppSpacing.sm + 2,
      ),
      decoration: BoxDecoration(
        gradient: isUser
            ? const LinearGradient(
                begin: Alignment(-1, -1),
                end: Alignment(1, 1),
                colors: [Color(0xFF2A4E7C), Color(0xFF0B1726)],
                stops: [0.0, 1.0],
              )
            : null,
        color: isUser ? null : colors.surface,
        borderRadius: radius,
        border: isUser
            ? null
            : Border.all(
                color: colors.hairline.withValues(alpha: 0.5), width: 0.6),
        boxShadow: isUser
            ? [
                BoxShadow(
                  color: const Color(0xFF0B1726).withValues(alpha: 0.28),
                  blurRadius: 14,
                  offset: const Offset(0, 5),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
      ),
      child: bubbleContent,
    );

    return Column(
      crossAxisAlignment:
          isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        // Assistant label strip
        if (!isUser) ...[
          _AssistantLabel(colors: colors, theme: theme),
          const SizedBox(height: AppSpacing.xxs + 2),
        ],
        Align(
          alignment: isUser
              ? AlignmentDirectional.centerEnd
              : AlignmentDirectional.centerStart,
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

/// The content column inside an assistant bubble: gold start bar + text.
class _AssistantContent extends StatelessWidget {
  const _AssistantContent({
    required this.message,
    required this.theme,
    required this.colors,
  });
  final ChatMessage message;
  final ThemeData theme;
  final AppColorsExt colors;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Gold start-edge accent bar
          Container(
            width: 3,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [AppPalette.gold400, AppPalette.gold300],
              ),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Flexible(
            child: Text(
              message.content,
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: colors.inkStrong, height: 1.55),
            ),
          ),
        ],
      ),
    );
  }
}

/// Tiny label strip above assistant bubbles: gold "AI" badge + sender name.
class _AssistantLabel extends StatelessWidget {
  const _AssistantLabel({required this.colors, required this.theme});
  final AppColorsExt colors;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFC8A24B), AppPalette.gold400],
            ),
            borderRadius: AppRadii.pillAll,
          ),
          child: const Text(
            'AI',
            style: TextStyle(
              color: AppPalette.navy,
              fontSize: 8.5,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.6,
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.xxs + 2),
        Text(
          context.l10n.chatTitle,
          style: theme.textTheme.labelSmall?.copyWith(
            color: colors.inkMuted,
            fontWeight: FontWeight.w600,
          ),
        ),
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
