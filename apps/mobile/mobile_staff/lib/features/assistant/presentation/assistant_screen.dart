import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';


import '../domain/assistant.dart';
import 'answer_text.dart';
import 'assistant_cubit.dart';

/// AI2 — «المساعد الذكي»: a rep asks about the company's data they can see
/// (overdue installments, available units, leads, visits…). It only reads.
class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key});

  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<AssistantCubit>().load();
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _send([String? text]) {
    final q = (text ?? _input.text).trim();
    if (q.isEmpty) return;
    _input.clear();
    FocusScope.of(context).unfocus();
    context.read<AssistantCubit>().ask(q);
  }

  void _toEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.read<AssistantCubit>();

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
      body: BlocConsumer<AssistantCubit, AssistantState>(
        listenWhen: (a, b) => a.turns.length != b.turns.length || a.pending != b.pending || a.draft != b.draft,
        listener: (context, state) {
          if (state.draft != null && _input.text.isEmpty) {
            _input.text = state.draft!;
          }
          _toEnd();
        },
        builder: (context, state) {
          final blocked = state.blockedReason;
          return Column(
            children: [
              HomeListHero(
                title: l10n.assistantTitle,
                subtitle: l10n.asSubtitle,
                back: true,
                actions: [
                  if (state.turns.isNotEmpty) HomeHeroButton(key: const Key('assistant-new-chat'), icon: Icons.restart_alt_rounded, tooltip: l10n.assistantNewChat, onTap: cubit.clear),
                ],
              ),
              if (blocked != null) _Notice(text: _blockedText(l10n, blocked)),
              Expanded(
                child: state.turns.isEmpty && !state.pending
                    ? _Welcome(canAsk: state.canAsk, onPick: _send)
                    : ListView(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.md),
                        children: [
                          for (final t in state.turns) _Bubble(turn: t),
                          if (state.pending) const _Thinking(),
                        ],
                      ),
              ),
              _Composer(
                controller: _input,
                enabled: state.canAsk,
                pending: state.pending,
                error: state.error == null ? null : _errorText(context, state.error!),
                onSend: _send,
              ),
            ],
          );
        },
      ),
      ),
    );
  }
}

String _blockedText(AppLocalizations l10n, String reason) => switch (reason) {
  'NOT_CONFIGURED' => l10n.assistantNotConfigured,
  'EXHAUSTED' => l10n.assistantExhausted,
  _ => l10n.assistantNotActive,
};

String _errorText(BuildContext context, AssistantError e) {
  final l10n = context.l10n;
  return switch (e.code) {
    'AI_QUOTA_EXHAUSTED' => l10n.assistantErrorExhausted,
    'AI_NOT_ACTIVE' => l10n.assistantErrorNotActive,
    'AI_NOT_CONFIGURED' => l10n.assistantNotConfigured,
    'AI_UNAVAILABLE' => l10n.assistantErrorUnavailable,
    'RATE' => l10n.assistantErrorRate,
    _ => e.failure?.userMessage(l10n) ?? l10n.errorUnknown,
  };
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('assistant-unavailable'),
      margin: const EdgeInsets.fromLTRB(AppSpacing.md, 14, AppSpacing.md, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: const Color(0xFFFCEBCF), borderRadius: BorderRadius.circular(16)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_rounded, size: 19, color: Color(0xFF8A5A12)),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Text(text, style: const TextStyle(fontSize: 12.5, height: 1.5, color: Color(0xFF6B4510))),
          ),
        ],
      ),
    );
  }
}

class _Welcome extends StatelessWidget {
  const _Welcome({required this.canAsk, required this.onPick});
  final bool canAsk;
  final void Function(String) onPick;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final c = context.appColors;
    final suggestions = [
      l10n.assistantSuggestOverdue,
      l10n.assistantSuggestUnits,
      l10n.assistantSuggestSummary,
      l10n.assistantSuggestVisits,
    ];
    return ListView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.lg, AppSpacing.md, AppSpacing.md),
      children: [
        Center(
          child: Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              gradient: const LinearGradient(
                colors: [AppPalette.gold500, AppPalette.gold300],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppPalette.gold400.withValues(alpha: 0.30),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: const Icon(Icons.auto_awesome_rounded, color: AppPalette.navy, size: 32),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          l10n.assistantWelcome,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: c.inkStrong),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          l10n.assistantScopeHint,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 13, height: 1.6, color: c.inkMuted),
        ),
        const SizedBox(height: AppSpacing.lg),
        for (var k = 0; k < suggestions.length; k++)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: _Suggestion(
              key: Key('assistant-suggestion-$k'),
              text: suggestions[k],
              onTap: canAsk ? () => onPick(suggestions[k]) : null,
            ),
          ),
      ],
    );
  }
}

class _Suggestion extends StatelessWidget {
  const _Suggestion({super.key, required this.text, this.onTap});
  final String text;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    return Opacity(
      opacity: onTap == null ? 0.5 : 1,
      child: Material(
        color: c.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: c.hairline),
            ),
            child: Row(
              children: [
                const Icon(Icons.chat_bubble_rounded, size: 18, color: AppPalette.gold600),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(text, style: TextStyle(fontSize: 14, color: c.ink)),
                ),
                Icon(Icons.north_west_rounded, size: 16, color: c.inkMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.turn});
  final AiTurn turn;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    final user = turn.isUser;
    final maxW = MediaQuery.sizeOf(context).width * (user ? 0.8 : 0.9);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Align(
        // The rep's questions on the reading side, the answers across.
        alignment: user ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxW),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: user ? AppPalette.navy : c.surface,
              border: user ? null : Border.all(color: c.hairline),
              borderRadius: BorderRadiusDirectional.only(
                topStart: const Radius.circular(18),
                topEnd: const Radius.circular(18),
                bottomStart: Radius.circular(user ? 4 : 18),
                bottomEnd: Radius.circular(user ? 18 : 4),
              ),
              boxShadow: user ? null : c.shadowSoft,
            ),
            child: user
                ? Text(
                    latinAnswer(turn.content),
                    style: const TextStyle(fontSize: 14, height: 1.5, color: Colors.white),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.auto_awesome_rounded, size: 14, color: AppPalette.gold500),
                          const SizedBox(width: 4),
                          Text(
                            context.l10n.assistantTitle,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppPalette.gold600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      AnswerText(turn.content),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _Thinking extends StatelessWidget {
  const _Thinking();

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    return Align(
      alignment: AlignmentDirectional.centerEnd,
      child: Container(
        key: const Key('assistant-thinking'),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: c.surface,
          border: Border.all(color: c.hairline),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: c.brandGold)),
            const SizedBox(width: AppSpacing.xs),
            Text(context.l10n.assistantThinking, style: TextStyle(fontSize: 13, color: c.inkMuted)),
          ],
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.enabled,
    required this.pending,
    required this.error,
    required this.onSend,
  });
  final TextEditingController controller;
  final bool enabled;
  final bool pending;
  final String? error;
  final void Function([String?]) onSend;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    final l10n = context.l10n;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.sm + bottom),
      decoration: BoxDecoration(
        color: c.canvas,
        border: Border(top: BorderSide(color: c.hairline)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (error != null) ...[
            Text(
              error!,
              key: const Key('assistant-error'),
              style: TextStyle(fontSize: 12.5, height: 1.5, color: c.error),
            ),
            const SizedBox(height: AppSpacing.xs),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  key: const Key('assistant-input'),
                  controller: controller,
                  enabled: enabled || pending,
                  minLines: 1,
                  maxLines: 4,
                  maxLength: 2000,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => enabled ? onSend() : null,
                  style: TextStyle(fontSize: 14, color: c.ink),
                  decoration: InputDecoration(
                    hintText: l10n.assistantPlaceholder,
                    counterText: '',
                    isDense: true,
                    filled: true,
                    fillColor: c.surface,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(99),
                      borderSide: BorderSide(color: c.hairline, width: 1.5),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(99),
                      borderSide: BorderSide(color: c.hairline, width: 1.5),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(99),
                      borderSide: const BorderSide(color: AppPalette.gold400),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              ValueListenableBuilder<TextEditingValue>(
                valueListenable: controller,
                builder: (context, value, _) {
                  final can = enabled && value.text.trim().isNotEmpty;
                  return Semantics(
                    button: true,
                    label: l10n.assistantSend,
                    child: GestureDetector(
                      key: const Key('assistant-send'),
                      onTap: can ? onSend : null,
                      child: AnimatedOpacity(
                        duration: const Duration(milliseconds: 150),
                        opacity: can || pending ? 1 : 0.45,
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: const BoxDecoration(shape: BoxShape.circle, color: AppPalette.gold400),
                          child: pending
                              ? const Padding(
                                  padding: EdgeInsets.all(12),
                                  child: CircularProgressIndicator(strokeWidth: 2, color: AppPalette.navy),
                                )
                              : const Icon(Icons.send_rounded, color: AppPalette.navy, size: 20),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ],
      ),
    );
  }
}
