import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:share_plus/share_plus.dart';

import '../../leads/presentation/follow_up_labels.dart';
import '../domain/signature_request.dart';
import 'signature_cubit.dart';

/// A phone number kept left-to-right inside Arabic text.
String _ltr(String s) => '\u2066${latinDigits(s)}\u2069';

/// P5 on a booking: «توقيع العميل». Send the booking form to the customer to
/// sign online, share the link, see where it stands, cancel an open one.
class SignatureSection extends StatelessWidget {
  const SignatureSection({super.key, required this.reservationId, required this.bookingStatus, this.customerName});
  final String reservationId;
  final String bookingStatus;
  final String? customerName;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (ctx) => SignatureCubit(ctx.read<SignatureRequestsRepository>(), reservationId: reservationId)..load(),
      child: _SignatureBody(bookingStatus: bookingStatus, customerName: customerName),
    );
  }
}

class _SignatureBody extends StatelessWidget {
  const _SignatureBody({required this.bookingStatus, this.customerName});
  final String bookingStatus;
  final String? customerName;

  Future<void> _send(BuildContext context, {required bool replace}) async {
    final l10n = context.l10n;
    if (replace) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(l10n.signNewLinkTitle),
          content: Text(l10n.signNewLinkBody),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(l10n.actionCancel)),
            FilledButton(onPressed: () => Navigator.of(ctx).pop(true), child: Text(l10n.signSendNew)),
          ],
        ),
      );
      if (ok != true || !context.mounted) return;
    }
    await context.read<SignatureCubit>().send(locale: Localizations.localeOf(context).languageCode);
  }

  Future<void> _cancel(BuildContext context, SignatureRequest r) async {
    final l10n = context.l10n;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.signCancelTitle),
        content: Text(l10n.signCancelBody),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(l10n.actionCancel)),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: context.appColors.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.signCancelConfirm),
          ),
        ],
      ),
    );
    if (ok == true && context.mounted) await context.read<SignatureCubit>().cancel(r.id);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BlocConsumer<SignatureCubit, SignatureState>(
      listenWhen: (a, b) => a.sent != b.sent || a.actionFailure != b.actionFailure,
      listener: (context, state) {
        if (state.actionFailure != null) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.actionFailure!.userMessage(l10n))));
        }
        final sent = state.sent;
        if (sent != null && sent.url.isNotEmpty) {
          showModalBottomSheet<void>(
            context: context,
            backgroundColor: Colors.transparent,
            builder: (_) => _LinkSheet(url: sent.url, phone: sent.request.phone, customerName: customerName),
          );
        }
      },
      builder: (context, state) {
        final latest = state.latest;
        final signable = bookingSignable(bookingStatus);
        // Nothing to show on a booking that is over and was never sent.
        if (!signable && state.requests.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Label(l10n.signTitle),
            const SizedBox(height: AppSpacing.sm),
            switch (state.status) {
              DataStatus.initial || DataStatus.loading => const _Card(child: _Line()),
              DataStatus.failure => _Card(
                  child: Row(
                    children: [
                      Expanded(child: Text(state.failure?.userMessage(l10n) ?? l10n.errorUnknown)),
                      TextButton(onPressed: context.read<SignatureCubit>().load, child: Text(l10n.actionRetry)),
                    ],
                  ),
                ),
              _ => _StatusCard(
                  latest: latest,
                  signable: signable,
                  working: state.working,
                  onSend: () => _send(context, replace: latest?.isPending ?? false),
                  onCancel: latest != null && latest.isPending ? () => _cancel(context, latest) : null,
                ),
            },
            const SizedBox(height: AppSpacing.md),
          ],
        );
      },
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.latest,
    required this.signable,
    required this.working,
    required this.onSend,
    this.onCancel,
  });
  final SignatureRequest? latest;
  final bool signable;
  final bool working;
  final VoidCallback onSend;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final c = context.appColors;
    final lang = Localizations.localeOf(context).languageCode;
    final r = latest;
    final (icon, color, title) = switch (r?.state) {
      'SIGNED' => (Icons.verified_rounded, c.success, l10n.signStateSigned),
      'PENDING' => (Icons.hourglass_top_rounded, c.warning, l10n.signStatePending),
      'EXPIRED' => (Icons.timer_off_rounded, c.inkMuted, l10n.signStateExpired),
      'CANCELLED' => (Icons.block_rounded, c.inkMuted, l10n.signStateCancelled),
      _ => (Icons.draw_rounded, AppPalette.gold500, l10n.signNotSent),
    };
    String when(DateTime? d) => d == null ? '' : followUpWhen(d, l10n, lang);

    final lines = <String>[
      if (r == null) l10n.signNotSentHint,
      if (r != null && r.isPending && r.phone != null) l10n.signCodeTo(_ltr(r.phone!)),
      if (r != null && r.isPending && r.expiresAt != null) l10n.signExpires(when(r.expiresAt)),
      if (r != null && r.isSigned) l10n.signSignedBy(r.signerName ?? '—', when(r.signedAt)),
      if (r != null && !r.isPending && !r.isSigned && r.createdAt != null) l10n.signSentAt(when(r.createdAt)),
    ];
    final image = r?.isSigned == true ? r!.signatureBytes : null;

    return _Card(
      key: const Key('signature-card'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                  border: Border.all(color: color.withValues(alpha: 0.25)),
                ),
                child: Icon(icon, size: 18, color: color),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: c.inkStrong)),
                    for (final line in lines) ...[
                      const SizedBox(height: 3),
                      Text(line, style: TextStyle(fontSize: 13, height: 1.5, color: c.inkMuted)),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (r != null && r.isSigned && r.outdated) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              key: const Key('signature-outdated'),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: c.warning.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(AppRadii.sm),
              ),
              child: Row(
                children: [
                  Icon(Icons.warning_amber_rounded, size: 16, color: c.warning),
                  const SizedBox(width: 6),
                  Expanded(child: Text(l10n.signOutdated, style: TextStyle(fontSize: 12.5, height: 1.5, color: c.ink))),
                ],
              ),
            ),
          ],
          if (image != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              height: 90,
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppRadii.sm),
                border: Border.all(color: c.hairline),
              ),
              child: Image.memory(image, fit: BoxFit.contain),
            ),
          ],
          if (signable && (r == null || !r.isSigned || r.outdated)) ...[
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                if (onCancel != null) ...[
                  Expanded(
                    child: OutlinedButton(
                      key: const Key('signature-cancel'),
                      onPressed: working ? null : onCancel,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: c.error,
                        side: BorderSide(color: c.error.withValues(alpha: 0.4)),
                        minimumSize: const Size.fromHeight(46),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
                      ),
                      child: Text(l10n.signCancel),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                ],
                Expanded(
                  child: _GoldButton(
                    key: const Key('signature-send'),
                    label: r == null ? l10n.signSend : l10n.signSendNew,
                    icon: Icons.send_rounded,
                    busy: working,
                    onTap: working ? null : onSend,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// The link just made: share it, or copy it. It is not shown again.
class _LinkSheet extends StatelessWidget {
  const _LinkSheet({required this.url, this.phone, this.customerName});
  final String url;
  final String? phone;
  final String? customerName;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final c = context.appColors;
    final message = l10n.signShareMessage(customerName ?? '', url);
    return Container(
      key: const Key('signature-link-sheet'),
      decoration: BoxDecoration(color: c.surface, borderRadius: AppRadii.sheet),
      padding: EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.lg + MediaQuery.paddingOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: c.hairline, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Icon(Icons.check_circle_rounded, color: c.success),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(l10n.signLinkReady, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: c.inkStrong)),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            phone == null ? l10n.signLinkHint : '${l10n.signLinkHint} ${l10n.signCodeTo(_ltr(phone!))}',
            style: TextStyle(fontSize: 13, height: 1.6, color: c.inkMuted),
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: c.surfaceSoft,
              borderRadius: BorderRadius.circular(AppRadii.sm),
              border: Border.all(color: c.hairline),
            ),
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: Text(url, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: c.ink)),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  key: const Key('signature-copy'),
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: url));
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.signCopied)));
                    }
                  },
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  label: Text(l10n.signCopy),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: c.inkStrong,
                    side: BorderSide(color: c.hairline),
                    minimumSize: const Size.fromHeight(46),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _GoldButton(
                  key: const Key('signature-share'),
                  label: l10n.signShare,
                  icon: Icons.ios_share_rounded,
                  onTap: () => Share.share(message, subject: l10n.signTitle),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _GoldButton extends StatelessWidget {
  const _GoldButton({super.key, required this.label, required this.icon, this.onTap, this.busy = false});
  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onTap == null && !busy ? 0.5 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadii.md),
          child: Ink(
            height: 46,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppPalette.gold600, AppPalette.gold400]),
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Center(
              child: busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(icon, size: 17, color: Colors.white),
                        const SizedBox(width: 6),
                        Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: c.hairline.withValues(alpha: 0.6)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: child,
    );
  }
}

class _Line extends StatelessWidget {
  const _Line();

  @override
  Widget build(BuildContext context) => Container(
        height: 38,
        decoration: BoxDecoration(color: context.appColors.surfaceSoft, borderRadius: BorderRadius.circular(AppRadii.sm)),
      );
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 20,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppPalette.gold300, AppPalette.gold500],
            ),
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          text,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: context.appColors.inkStrong,
                letterSpacing: -0.2,
              ),
        ),
      ],
    );
  }
}
