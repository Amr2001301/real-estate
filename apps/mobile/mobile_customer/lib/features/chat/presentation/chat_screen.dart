import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'chat_bloc.dart';
import 'chat_event.dart';
import 'chat_state.dart';
import 'widgets/chat_widgets.dart';

// Navy depth tokens.

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _send([String? text]) {
    final content = (text ?? _input.text).trim();
    if (content.isEmpty) return;
    context.read<ChatBloc>().add(ChatMessageSent(content));
    _input.clear();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent + 120,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: context.appColors.canvas,
        body: Column(
          children: [
            // Navy header
            _ChatHeader(
              topInset: topInset,
              onBack: () =>
                  context.canPop() ? context.pop() : context.go('/home'),
              onRestart: () =>
                  context.read<ChatBloc>().add(const ChatStarted()),
            ),
            // Body — BlocConsumer drives the message list + input
            Expanded(
              child: BlocConsumer<ChatBloc, ChatState>(
                listenWhen: (prev, curr) =>
                    (prev.sendError != curr.sendError &&
                        curr.sendError != null) ||
                    prev.messages.length != curr.messages.length,
                listener: (context, state) {
                  if (state.sendError != null) {
                    showFailureSnackBar(
                      context,
                      state.sendError!,
                      onRetry: state.retryContent == null
                          ? null
                          : () => _send(state.retryContent),
                    );
                  }
                  _scrollToBottom();
                },
                builder: (context, state) {
                  if (state.status == ChatStatus.initializing) {
                    return Center(
                      child: CircularProgressIndicator(
                        color: context.appColors.brandGold,
                        strokeWidth: 2.5,
                      ),
                    );
                  }
                  if (state.status == ChatStatus.failed) {
                    return ErrorState(
                      failure: state.sessionFailure,
                      onRetry: () =>
                          context.read<ChatBloc>().add(const ChatStarted()),
                    );
                  }
                  final welcome = state.messages.length <= 1 && !state.sending;
                  return Column(
                    children: [
                      Expanded(
                        child: welcome
                            ? _Welcome(
                                greeting: state.messages.firstOrNull?.content ?? '',
                                replies: state.quickReplies,
                              )
                            : ListView.separated(
                                controller: _scroll,
                                padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.md),
                                itemCount: state.messages.length + (state.sending ? 1 : 0),
                                separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                                itemBuilder: (context, i) {
                                  if (i >= state.messages.length) return const _TypingBubble();
                                  return ChatBubble(message: state.messages[i]);
                                },
                              ),
                      ),
                      if (!welcome && state.quickReplies.isNotEmpty) ...[
                        QuickReplies(replies: state.quickReplies),
                        const SizedBox(height: AppSpacing.xs),
                      ],
                      _InputBar(
                        controller: _input,
                        onSend: _send,
                        sending: state.sending,
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The first screen: a gold mark, the assistant's greeting and what to ask.
class _Welcome extends StatelessWidget {
  const _Welcome({required this.greeting, required this.replies});
  final String greeting;
  final List<String> replies;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.lg, AppSpacing.md, AppSpacing.md),
      children: [
        Center(
          child: Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              gradient: const LinearGradient(colors: [AppPalette.gold500, AppPalette.gold300], begin: Alignment.topLeft, end: Alignment.bottomRight),
              boxShadow: [BoxShadow(color: AppPalette.gold400.withValues(alpha: 0.30), blurRadius: 16, offset: const Offset(0, 6))],
            ),
            child: const Icon(Icons.auto_awesome_rounded, color: AppPalette.navy, size: 32),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(greeting, textAlign: TextAlign.center, style: TextStyle(fontSize: 16, height: 1.6, fontWeight: FontWeight.w700, color: c.inkStrong)),
        const SizedBox(height: AppSpacing.lg),
        ChatSuggestions(replies: replies),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Navy header
// ─────────────────────────────────────────────────────────────────────────────

class _ChatHeader extends StatelessWidget {
  const _ChatHeader({
    required this.topInset,
    required this.onBack,
    required this.onRestart,
  });

  final double topInset;
  final VoidCallback onBack;
  final VoidCallback onRestart;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppNavHeader(
      title: l10n.chatTitle,
      subtitle: l10n.assistantTitle,
      compact: true,
      leadingAction: NavHeaderBack(onTap: onBack),
      actions: [NavHeaderAction(icon: Icons.refresh_rounded, tooltip: l10n.chatRestart, onTap: onRestart)],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Typing indicator
// ─────────────────────────────────────────────────────────────────────────────

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    return Align(
      alignment: AlignmentDirectional.centerEnd,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(color: c.surface, border: Border.all(color: c.hairline), borderRadius: BorderRadius.circular(18)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: c.brandGold)),
          const SizedBox(width: AppSpacing.xs),
          Text(context.l10n.assistantThinking, style: TextStyle(fontSize: 13, color: c.inkMuted)),
        ]),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Input bar
// ─────────────────────────────────────────────────────────────────────────────

class _InputBar extends StatelessWidget {
  const _InputBar({required this.controller, required this.onSend, required this.sending});

  final TextEditingController controller;
  final void Function([String?]) onSend;
  final bool sending;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.sm + bottom),
      decoration: BoxDecoration(color: c.canvas, border: Border(top: BorderSide(color: c.hairline))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              minLines: 1,
              maxLines: 4,
              maxLength: 2000,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              style: TextStyle(fontSize: 14, color: c.ink),
              decoration: InputDecoration(
                hintText: context.l10n.chatInputHint,
                counterText: '',
                isDense: true,
                filled: true,
                fillColor: c.surface,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: BorderSide(color: c.hairline, width: 1.5)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: BorderSide(color: c.hairline, width: 1.5)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(99), borderSide: const BorderSide(color: AppPalette.gold400)),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (context, value, _) {
              final can = !sending && value.text.trim().isNotEmpty;
              return GestureDetector(
                onTap: can ? () => onSend() : null,
                child: AnimatedOpacity(
                  duration: const Duration(milliseconds: 150),
                  opacity: can || sending ? 1 : 0.45,
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(shape: BoxShape.circle, color: AppPalette.gold400),
                    child: sending
                        ? const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.navy))
                        : const Icon(Icons.send_rounded, color: AppPalette.navy, size: 20),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
