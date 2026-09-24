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
const _navyDeep = Color(0xFF0B1726);
const _navyMid = Color(0xFF14273F);

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
                  return Column(
                    children: [
                      // Message list
                      Expanded(
                        child: ListView.separated(
                          controller: _scroll,
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.lg,
                            AppSpacing.lg,
                            AppSpacing.lg,
                            AppSpacing.md,
                          ),
                          itemCount:
                              state.messages.length + (state.sending ? 1 : 0),
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: AppSpacing.lg),
                          itemBuilder: (context, i) {
                            if (i >= state.messages.length) {
                              return const _TypingBubble();
                            }
                            return ChatBubble(message: state.messages[i]);
                          },
                        ),
                      ),
                      // Quick-reply pills
                      if (state.quickReplies.isNotEmpty) ...[
                        QuickReplies(replies: state.quickReplies),
                        const SizedBox(height: AppSpacing.xs),
                      ],
                      // Input bar
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
    final rtl = Directionality.of(context) == TextDirection.rtl;

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [_navyDeep, _navyMid],
        ),
        border: Border(
          bottom: BorderSide(color: Color(0x4DB8941F), width: 0.5),
        ),
      ),
      padding: EdgeInsets.only(top: topInset),
      child: SizedBox(
        height: 60,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Back button — end side (LEFT in RTL, RIGHT in LTR means wrong
              // for a back button; we override with explicit position).
              Align(
                alignment: rtl ? Alignment.centerRight : Alignment.centerLeft,
                child: _HeaderBtn(
                  icon: !rtl
                      ? Icons.chevron_right_rounded
                      : Icons.chevron_left_rounded,
                  onTap: onBack,
                ),
              ),
              // Centred title + AI badge
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    l10n.chatTitle,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 17,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 2),
                  _AiBadge(),
                ],
              ),
              // Restart — opposite side
              Align(
                alignment: rtl ? Alignment.centerLeft : Alignment.centerRight,
                child: _HeaderBtn(
                  icon: Icons.refresh_rounded,
                  onTap: onRestart,
                  tooltip: l10n.chatRestart,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeaderBtn extends StatelessWidget {
  const _HeaderBtn({required this.icon, required this.onTap, this.tooltip});
  final IconData icon;
  final VoidCallback onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(AppRadii.md),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: Tooltip(
          message: tooltip ?? '',
          child: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.md),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.20),
                width: 0.6,
              ),
            ),
            child: Icon(icon, size: 18, color: Colors.white),
          ),
        ),
      ),
    );
  }
}

/// Small gold gradient "AI" badge underneath the title.
class _AiBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFC8A24B), AppPalette.gold400],
        ),
        borderRadius: AppRadii.pillAll,
      ),
      child: const Text(
        'المساعد الذكي',
        style: TextStyle(
          color: AppPalette.navy,
          fontSize: 9.5,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.5,
        ),
      ),
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
    final colors = context.appColors;
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm + 3,
        ),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(AppRadii.xl),
            topRight: Radius.circular(AppRadii.xl),
            bottomLeft: Radius.circular(AppRadii.xs),
            bottomRight: Radius.circular(AppRadii.xl),
          ),
          border: Border.all(
            color: colors.hairline.withValues(alpha: 0.5),
            width: 0.6,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: const SizedBox(width: 44, height: 14, child: _GoldDots()),
      ),
    );
  }
}

class _GoldDots extends StatelessWidget {
  const _GoldDots();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        for (var i = 0; i < 3; i++)
          Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppPalette.gold400,
                  shape: BoxShape.circle,
                ),
              )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .scaleXY(
                begin: 0.55,
                end: 1.0,
                delay: (i * 200).ms,
                duration: 380.ms,
                curve: Curves.easeInOut,
              )
              .fadeIn(begin: 0.3, delay: (i * 200).ms, duration: 380.ms),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Input bar
// ─────────────────────────────────────────────────────────────────────────────

class _InputBar extends StatelessWidget {
  const _InputBar({
    required this.controller,
    required this.onSend,
    required this.sending,
  });

  final TextEditingController controller;
  final void Function([String?]) onSend;
  final bool sending;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;

    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.xs,
          AppSpacing.lg,
          AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadii.pillAll,
          border: Border.all(color: colors.hairline.withValues(alpha: 0.8)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.07),
              blurRadius: 14,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: colors.inkStrong),
                decoration: InputDecoration(
                  hintText: context.l10n.chatInputHint,
                  hintStyle: TextStyle(
                    color: colors.inkMuted.withValues(alpha: 0.6),
                    fontSize: 14,
                  ),
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.md,
                    AppSpacing.xs,
                    AppSpacing.md,
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.xs),
              child: _SendButton(
                onTap: sending ? null : () => onSend(),
                sending: sending,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({this.onTap, required this.sending});
  final VoidCallback? onTap;
  final bool sending;

  @override
  Widget build(BuildContext context) {
    final active = onTap != null && !sending;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          gradient: active
              ? const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppPalette.gold300, AppPalette.gold500],
                )
              : LinearGradient(
                  colors: [
                    context.appColors.hairline,
                    context.appColors.hairline,
                  ],
                ),
          shape: BoxShape.circle,
          boxShadow: active
              ? [
                  BoxShadow(
                    color: AppPalette.gold400.withValues(alpha: 0.40),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: sending
            ? const Center(
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    color: AppPalette.navy,
                    strokeWidth: 2,
                  ),
                ),
              )
            : const Icon(
                Icons.arrow_upward_rounded,
                color: AppPalette.navy,
                size: 20,
              ),
      ),
    );
  }
}
