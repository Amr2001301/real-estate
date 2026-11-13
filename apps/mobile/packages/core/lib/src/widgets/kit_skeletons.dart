import 'package:flutter/material.dart';
import 'package:skeletonizer/skeletonizer.dart';

import '../design/tokens/app_spacing.dart';
import 'app_card.dart';
import 'app_skeleton.dart';

/// Loading shapes for screens whose content is not a plain list: the same kit
/// cards the screens use, with shimmering bones where the data will be — so a
/// screen never shows a bare spinner while it loads (owner, 2026-11-13).

/// Cards in a column: an icon tile, two lines and a status pill — a list of records.
class KitCardsSkeleton extends StatelessWidget {
  const KitCardsSkeleton({super.key, this.count = 4, this.padding = const EdgeInsets.all(AppSpacing.lg)});

  final int count;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        padding: padding,
        itemCount: count,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
        itemBuilder: (_, _) => const AppCard(
          child: Row(children: [
            Bone.square(size: 44, borderRadius: BorderRadius.all(Radius.circular(12))),
            SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Bone.text(words: 3),
                SizedBox(height: 6),
                Bone.text(words: 2, fontSize: 12),
              ]),
            ),
            SizedBox(width: AppSpacing.sm),
            Bone(width: 64, height: 24, borderRadius: BorderRadius.all(Radius.circular(12))),
          ]),
        ),
      ),
    );
  }
}

/// A detail screen: the photo hero, the name, a card of facts and a card of text.
class KitDetailSkeleton extends StatelessWidget {
  const KitDetailSkeleton({super.key, this.heroHeight = 230, this.facts = 4});

  final double heroHeight;
  final int facts;

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          if (heroHeight > 0) ...[
            Bone(height: heroHeight, width: double.infinity, borderRadius: const BorderRadius.all(Radius.circular(22))),
            const SizedBox(height: AppSpacing.lg),
          ],
          const Bone.text(words: 3, fontSize: 22),
          const SizedBox(height: 8),
          const Bone.text(words: 4, fontSize: 13),
          const SizedBox(height: AppSpacing.lg),
          AppCard(
            child: Column(children: [
              for (var i = 0; i < facts; i++)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Bone.text(words: 2, fontSize: 13),
                    Bone.text(words: 2, fontSize: 15),
                  ]),
                ),
            ]),
          ),
          const SizedBox(height: AppSpacing.md),
          const AppCard(child: Bone.multiText(lines: 4)),
        ],
      ),
    );
  }
}

/// A form screen: an optional avatar, labelled fields and the save button.
class KitFormSkeleton extends StatelessWidget {
  const KitFormSkeleton({super.key, this.fields = 4, this.avatar = false});

  final int fields;
  final bool avatar;

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          AppCard(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (avatar) ...[
                const Center(child: Bone.circle(size: 84)),
                const SizedBox(height: AppSpacing.lg),
              ],
              for (var i = 0; i < fields; i++) ...[
                const Bone.text(words: 2, fontSize: 13),
                const SizedBox(height: 8),
                const Bone(height: 50, width: double.infinity, borderRadius: BorderRadius.all(Radius.circular(14))),
                const SizedBox(height: AppSpacing.md),
              ],
              const SizedBox(height: AppSpacing.sm),
              const Bone(height: 50, width: double.infinity, borderRadius: BorderRadius.all(Radius.circular(16))),
            ]),
          ),
        ],
      ),
    );
  }
}

/// A settings screen: a line of help, then groups of rows with a switch each.
class KitSettingsSkeleton extends StatelessWidget {
  const KitSettingsSkeleton({super.key, this.groups = 3, this.rows = 3});

  final int groups;
  final int rows;

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          const Bone.multiText(lines: 2, fontSize: 13),
          for (var g = 0; g < groups; g++) ...[
            const SizedBox(height: AppSpacing.lg),
            const Bone.text(words: 2),
            const SizedBox(height: AppSpacing.sm),
            AppCard(
              child: Column(children: [
                for (var r = 0; r < rows; r++)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Row(children: [
                      Expanded(child: Bone.text(words: 3)),
                      Bone(width: 44, height: 26, borderRadius: BorderRadius.all(Radius.circular(13))),
                    ]),
                  ),
              ]),
            ),
          ],
        ],
      ),
    );
  }
}

/// A hub screen: an optional figures band at the top (the navy card of
/// counts), then cards of the given heights, each with a title and lines.
class KitSectionsSkeleton extends StatelessWidget {
  const KitSectionsSkeleton({super.key, this.band = true, this.cards = const [150, 240]});

  final bool band;
  final List<double> cards;

  @override
  Widget build(BuildContext context) {
    return AppSkeletonizer(
      enabled: true,
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          if (band) ...[
            const Bone(height: 104, width: double.infinity, borderRadius: BorderRadius.all(Radius.circular(20))),
            const SizedBox(height: AppSpacing.lg),
          ],
          for (final h in cards) ...[
            AppCard(
              child: SizedBox(
                height: h - 32,
                child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Bone.square(size: 32, borderRadius: BorderRadius.all(Radius.circular(10))),
                    SizedBox(width: AppSpacing.sm),
                    Bone.text(words: 3),
                  ]),
                  SizedBox(height: AppSpacing.md),
                  Expanded(child: Bone.multiText(lines: 3, fontSize: 13)),
                ]),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ],
      ),
    );
  }
}
