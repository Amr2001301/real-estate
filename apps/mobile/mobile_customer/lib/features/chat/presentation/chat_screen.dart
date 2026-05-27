import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'chat_bloc.dart';
import 'chat_event.dart';
import 'chat_state.dart';
import 'widgets/chat_widgets.dart';

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
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.chatTitle),
        actions: [
          IconButton(
            tooltip: l10n.chatRestart,
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => context.read<ChatBloc>().add(const ChatStarted()),
          ),
        ],
      ),
      body: BlocConsumer<ChatBloc, ChatState>(
        listenWhen: (prev, curr) =>
            prev.sendError != curr.sendError && curr.sendError != null ||
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
            return const Center(child: CircularProgressIndicator());
          }
          if (state.status == ChatStatus.failed) {
            return ErrorState(
              failure: state.sessionFailure,
              onRetry: () => context.read<ChatBloc>().add(const ChatStarted()),
            );
          }
          return Column(
            children: [
              Expanded(
                child: ListView.separated(
                  controller: _scroll,
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: state.messages.length + (state.sending ? 1 : 0),
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, i) {
                    if (i >= state.messages.length) return const _TypingBubble();
                    return ChatBubble(message: state.messages[i]);
                  },
                ),
              ),
              QuickReplies(replies: state.quickReplies),
              const SizedBox(height: AppSpacing.xs),
              _InputBar(controller: _input, onSend: _send, sending: state.sending),
            ],
          );
        },
      ),
    );
  }
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();
  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surfaceSoft,
          borderRadius: AppRadii.card,
        ),
        child: const SizedBox(
          width: 36,
          height: 12,
          child: _Dots(),
        ),
      ),
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots();
  @override
  Widget build(BuildContext context) {
    final color = context.appColors.inkMuted;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        for (var i = 0; i < 3; i++)
          Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle))
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .fadeIn(delay: (i * 150).ms, duration: 400.ms),
      ],
    );
  }
}

class _InputBar extends StatelessWidget {
  const _InputBar({required this.controller, required this.onSend, required this.sending});
  final TextEditingController controller;
  final void Function([String?]) onSend;
  final bool sending;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.sm),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                decoration: InputDecoration(hintText: context.l10n.chatInputHint),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            IconButton.filled(
              style: IconButton.styleFrom(backgroundColor: colors.brandNavy),
              onPressed: sending ? null : () => onSend(),
              icon: const Icon(Icons.send_rounded),
            ),
          ],
        ),
      ),
    );
  }
}
