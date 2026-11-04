import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

/// Shared pieces of the customer's request forms (a visit, a question), as on
/// the website: what the request is about, how the company will reach the
/// customer, and the page shown once it is sent.

/// What the request is about: the unit or project, with its picture.
class RequestSubjectCard extends StatelessWidget {
  const RequestSubjectCard({super.key, required this.title, this.subtitle, this.imageUrl, this.isUnit = false});

  final String title;
  final String? subtitle;
  final String? imageUrl;
  final bool isUnit;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      key: const Key('request-subject'),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppPalette.gold400.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(13),
            child: SizedBox(
              width: 68,
              height: 68,
              child: imageUrl != null && imageUrl!.isNotEmpty
                  ? AppNetworkImage(url: imageUrl!)
                  : ColoredBox(
                      color: AppPalette.navy,
                      child: Icon(isUnit ? Icons.home_work_rounded : Icons.apartment_rounded, color: AppPalette.gold300),
                    ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(context.l10n.requestAbout, style: theme.textTheme.labelSmall?.copyWith(color: AppPalette.gold500)),
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w800),
                ),
                if (subtitle != null && subtitle!.isNotEmpty)
                  Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// «سنتواصل معك على»: the signed-in customer's name, phone and e-mail, with
/// a way to change them in the profile.
class RequestContactCard extends StatelessWidget {
  const RequestContactCard({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    final s = context.watch<SessionCubit>().state.sessionOrNull;
    final rows = <(IconData, String)>[
      if ((s?.displayName ?? '').isNotEmpty) (Icons.person_outline_rounded, s!.displayName!),
      if ((s?.phone ?? '').isNotEmpty) (Icons.phone_iphone_rounded, ltr(s!.phone!)),
      if ((s?.email ?? '').isNotEmpty) (Icons.alternate_email_rounded, s!.email!),
    ];
    if (rows.isEmpty) return const SizedBox.shrink();
    return Container(
      key: const Key('request-contact'),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceSoft,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(l10n.requestContactTitle,
                    style: theme.textTheme.labelLarge?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w800)),
              ),
              TextButton(
                onPressed: () => context.push('/account/profile'),
                child: Text(l10n.requestContactEdit),
              ),
            ],
          ),
          for (final (icon, text) in rows)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                children: [
                  Icon(icon, size: 17, color: AppPalette.gold500),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(child: Text(text, style: theme.textTheme.bodyMedium?.copyWith(color: colors.ink))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// A form's opening line: the reply time, with a clock.
class RequestReplyNote extends StatelessWidget {
  const RequestReplyNote({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        const Icon(Icons.schedule_rounded, size: 17, color: AppPalette.gold500),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(context.l10n.requestReplyNote, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
        ),
      ],
    );
  }
}

/// A form section's gold-barred label.
class RequestLabel extends StatelessWidget {
  const RequestLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      children: [
        Container(
          width: 3,
          height: 16,
          decoration: BoxDecoration(color: AppPalette.gold400, borderRadius: BorderRadius.circular(2)),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(text, style: Theme.of(context).textTheme.titleSmall?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w800)),
      ],
    );
  }
}

/// What the customer sees once a request is sent: a tick, what happens next,
/// and two ways on — the requests list and the projects.
class RequestDoneView extends StatelessWidget {
  const RequestDoneView({super.key, required this.title, required this.message, this.detail});

  final String title;
  final String message;

  /// A line under the message (the visit's day and time).
  final String? detail;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Center(
      key: const Key('request-done'),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(color: colors.success.withValues(alpha: 0.12), shape: BoxShape.circle),
              child: Icon(Icons.check_circle_rounded, size: 52, color: colors.success),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(title,
                textAlign: TextAlign.center,
                style: theme.textTheme.titleLarge?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w900)),
            const SizedBox(height: AppSpacing.sm),
            Text(message, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkMuted, height: 1.6)),
            if (detail != null) ...[
              const SizedBox(height: AppSpacing.md),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppPalette.gold400.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(detail!, style: theme.textTheme.bodyMedium?.copyWith(color: colors.inkStrong, fontWeight: FontWeight.w700)),
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            AppButton(
              label: l10n.requestGoToRequests,
              icon: Icons.inbox_rounded,
              expand: true,
              onPressed: () => context.go('/account/requests'),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: l10n.requestBrowseProjects,
              icon: Icons.apartment_rounded,
              variant: AppButtonVariant.outline,
              expand: true,
              onPressed: () => context.go('/projects'),
            ),
          ],
        ),
      ),
    );
  }
}
