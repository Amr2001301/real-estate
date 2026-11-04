import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../common/request_kit.dart';
import '../cubit/info_request_cubit.dart';

/// Topics a customer can tick instead of writing everything out.
enum InfoTopic { prices, areas, delivery, finishing, location }

String infoTopicLabel(AppLocalizations l10n, InfoTopic t) => switch (t) {
      InfoTopic.prices => l10n.infoTopicPrices,
      InfoTopic.areas => l10n.infoTopicAreas,
      InfoTopic.delivery => l10n.infoTopicDelivery,
      InfoTopic.finishing => l10n.infoTopicFinishing,
      InfoTopic.location => l10n.infoTopicLocation,
    };

/// The message sent: the ticked topics on their own line, then the text.
String infoRequestMessage(AppLocalizations l10n, Iterable<InfoTopic> topics, String text) {
  final lines = [
    if (topics.isNotEmpty) l10n.infoTopicsLine(topics.map((t) => infoTopicLabel(l10n, t)).join('، ')),
    if (text.trim().isNotEmpty) text.trim(),
  ];
  return lines.join('\n');
}

/// Asks the company a question about a project or a unit, as on the website:
/// what it is about, quick topics, a message, and who the company will reach.
class InfoRequestScreen extends StatefulWidget {
  const InfoRequestScreen({super.key, this.projectId, this.unitId, this.title, this.subtitle, this.imageUrl});

  final String? projectId;
  final String? unitId;
  final String? title;
  final String? subtitle;
  final String? imageUrl;

  @override
  State<InfoRequestScreen> createState() => _InfoRequestScreenState();
}

class _InfoRequestScreenState extends State<InfoRequestScreen> {
  final _messageCtrl = TextEditingController();
  final _topics = <InfoTopic>{};
  bool _missing = false;

  @override
  void dispose() {
    _messageCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final l10n = context.l10n;
    if (_topics.isEmpty && _messageCtrl.text.trim().isEmpty) {
      setState(() => _missing = true);
      return;
    }
    context.read<InfoRequestCubit>().submit(
          message: infoRequestMessage(l10n, InfoTopic.values.where(_topics.contains), _messageCtrl.text),
          projectId: widget.projectId,
          unitId: widget.unitId,
        );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;

    return Scaffold(
      body: Column(
        children: [
          AppNavHeader(title: l10n.infoRequestTitle, compact: true, leadingAction: const NavHeaderBack()),
          Expanded(
            child: BlocConsumer<InfoRequestCubit, InfoRequestState>(
              listener: (context, state) {
                if (state.status == InfoRequestStatus.failure && state.failure != null) {
                  showFailureSnackBar(context, state.failure!);
                }
              },
              builder: (context, state) {
                if (state.status == InfoRequestStatus.success) {
                  return RequestDoneView(title: l10n.infoDoneTitle, message: l10n.infoDoneMessage);
                }
                return ListView(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.lg,
                    AppSpacing.xl + MediaQuery.paddingOf(context).bottom,
                  ),
                  children: [
                    const RequestReplyNote(),
                    if (widget.title != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      RequestSubjectCard(
                        title: widget.title!,
                        subtitle: widget.subtitle,
                        imageUrl: widget.imageUrl,
                        isUnit: widget.unitId != null,
                      ),
                    ],
                    const SizedBox(height: AppSpacing.lg),
                    RequestLabel(l10n.infoTopicsTitle),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      key: const Key('info-topics'),
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: [
                        for (final t in InfoTopic.values)
                          FilterChip(
                            label: Text(infoTopicLabel(l10n, t)),
                            selected: _topics.contains(t),
                            showCheckmark: true,
                            selectedColor: AppPalette.gold400.withValues(alpha: 0.22),
                            checkmarkColor: AppPalette.navy,
                            side: BorderSide(color: _topics.contains(t) ? AppPalette.gold400 : colors.hairline),
                            onSelected: (on) => setState(() {
                              on ? _topics.add(t) : _topics.remove(t);
                              _missing = false;
                            }),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    RequestLabel(l10n.infoMessageOptional),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: _messageCtrl,
                      minLines: 4,
                      maxLines: 8,
                      textInputAction: TextInputAction.newline,
                      onChanged: (_) {
                        if (_missing) setState(() => _missing = false);
                      },
                      decoration: InputDecoration(hintText: l10n.infoRequestMessageHint, alignLabelWithHint: true),
                    ),
                    if (_missing)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.sm),
                        child: Text(l10n.infoTopicsRequired, style: TextStyle(color: colors.error)),
                      ),
                    const SizedBox(height: AppSpacing.lg),
                    const RequestContactCard(),
                    const SizedBox(height: AppSpacing.xl),
                    AppButton(
                      label: l10n.infoRequestSubmit,
                      icon: Icons.send_rounded,
                      variant: AppButtonVariant.gold,
                      expand: true,
                      isLoading: state.isSubmitting,
                      onPressed: state.isSubmitting ? null : _submit,
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
