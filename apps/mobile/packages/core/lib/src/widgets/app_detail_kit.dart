import 'package:flutter/material.dart';

import '../../core.dart';
import 'package:flutter/rendering.dart';


// The pieces of the project and unit pages, shared by both apps: the photos
// (counter, thumbnails, full screen), the price card, the section tabs, the
// payment plan table and the instalment calculator.

// ─────────────────────────────────────────────────────────────────────────────
// Photos
// ─────────────────────────────────────────────────────────────────────────────

/// The photos of a project or a unit: a 16:10 rounded card that swipes, with
/// "1 / 8", a full-screen button and an optional [badge] (bottom start), then
/// a strip of thumbnails when there is more than one photo. With no photos it
/// shows [placeholder].
class AppPhotoGallery extends StatefulWidget {
  const AppPhotoGallery({
    super.key,
    required this.images,
    this.placeholder,
    this.badge,
    this.overlay,
  });

  final List<String> images;
  final Widget? placeholder;
  final Widget? badge;

  /// Extra layer over the photo (e.g. a video button), under the controls.
  final Widget? overlay;

  @override
  State<AppPhotoGallery> createState() => _AppPhotoGalleryState();
}

class _AppPhotoGalleryState extends State<AppPhotoGallery> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _jump(int i) {
    _controller.animateToPage(i, duration: const Duration(milliseconds: 280), curve: Curves.easeOut);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final l10n = context.l10n;
    final images = widget.images;
    final count = images.length;

    final card = Container(
      key: const Key('detail-gallery'),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        boxShadow: colors.shadowSoft,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: AspectRatio(
          aspectRatio: 16 / 10,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (count == 0)
                widget.placeholder ?? ColoredBox(color: colors.surfaceSoft)
              else
                PageView.builder(
                  controller: _controller,
                  itemCount: count,
                  onPageChanged: (i) => setState(() => _index = i),
                  itemBuilder: (_, i) => GestureDetector(
                    onTap: () => showAppPhotoViewer(context, images, initial: i),
                    child: AppNetworkImage(url: images[i]),
                  ),
                ),
              if (widget.overlay != null) widget.overlay!,
              if (count > 1)
                PositionedDirectional(
                  top: AppSpacing.sm,
                  end: AppSpacing.sm,
                  child: _GlassChip(
                    key: const Key('detail-gallery-counter'),
                    child: Text(
                      // Always left to right: "1 / 8".
                      '\u2066${_index + 1} / $count\u2069',
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              if (count > 0)
                PositionedDirectional(
                  bottom: AppSpacing.sm,
                  end: AppSpacing.sm,
                  child: _GlassIconButton(
                    key: const Key('detail-gallery-fullscreen'),
                    icon: Icons.open_in_full_rounded,
                    tooltip: l10n.detailPhotosFullscreen,
                    onTap: () => showAppPhotoViewer(context, images, initial: _index),
                  ),
                ),
              if (widget.badge != null)
                PositionedDirectional(bottom: AppSpacing.sm, start: AppSpacing.sm, child: widget.badge!),
            ],
          ),
        ),
      ),
    );

    if (count < 2) return card;

    const shown = 5;
    // The last thumbnail covers its own photo too: "+3" for 7 photos.
    final extra = count > shown ? count - shown + 1 : 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        card,
        const SizedBox(height: AppSpacing.xs),
        SizedBox(
          height: 52,
          child: Row(
            children: [
              for (var i = 0; i < count && i < shown; i++) ...[
                if (i > 0) const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: _Thumb(
                    url: images[i],
                    selected: i == _index,
                    more: i == shown - 1 && extra > 0 ? extra : 0,
                    onTap: () => i == shown - 1 && extra > 0
                        ? showAppPhotoViewer(context, images, initial: i)
                        : _jump(i),
                  ),
                ),
              ],
              // Keep thumbnails the same size when there are fewer than five.
              for (var i = count; i < shown; i++) ...[
                const SizedBox(width: AppSpacing.xs),
                const Expanded(child: SizedBox()),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.url, required this.selected, required this.more, required this.onTap});
  final String url;
  final bool selected;
  final int more;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadii.sm),
          border: Border.all(color: selected ? colors.brandGold : Colors.transparent, width: 2),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.sm - 2),
          child: Stack(
            fit: StackFit.expand,
            children: [
              AppNetworkImage(url: url),
              if (more > 0)
                ColoredBox(
                  color: AppPalette.navy.withValues(alpha: 0.72),
                  child: Center(
                    child: Text(
                      '+$more',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GlassChip extends StatelessWidget {
  const _GlassChip({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: AppPalette.navy.withValues(alpha: 0.72),
          borderRadius: BorderRadius.circular(999),
        ),
        child: child,
      );
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({super.key, required this.icon, required this.tooltip, required this.onTap});
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Tooltip(
        message: tooltip,
        child: Material(
          color: AppPalette.navy.withValues(alpha: 0.72),
          borderRadius: BorderRadius.circular(AppRadii.md),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.md),
            onTap: onTap,
            child: SizedBox(width: 44, height: 44, child: Icon(icon, color: Colors.white, size: 20)),
          ),
        ),
      );
}

/// Opens [images] full screen at [initial]: swipe between them, pinch to zoom.
Future<void> showAppPhotoViewer(BuildContext context, List<String> images, {int initial = 0}) {
  if (images.isEmpty) return Future.value();
  return Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder<void>(
      opaque: false,
      barrierColor: Colors.black,
      pageBuilder: (_, _, _) => _PhotoViewer(images: images, initial: initial),
      transitionsBuilder: (_, anim, _, child) => FadeTransition(opacity: anim, child: child),
    ),
  );
}

class _PhotoViewer extends StatefulWidget {
  const _PhotoViewer({required this.images, required this.initial});
  final List<String> images;
  final int initial;

  @override
  State<_PhotoViewer> createState() => _PhotoViewerState();
}

class _PhotoViewerState extends State<_PhotoViewer> {
  late final _controller = PageController(initialPage: widget.initial);
  late int _index = widget.initial;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      key: const Key('photo-viewer'),
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: widget.images.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (_, i) => InteractiveViewer(
              maxScale: 4,
              child: Center(child: AppNetworkImage(url: widget.images[i], fit: BoxFit.contain)),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Row(
                children: [
                  _GlassIconButton(
                    key: const Key('photo-viewer-close'),
                    icon: Icons.close_rounded,
                    tooltip: l10n.detailClose,
                    onTap: () => Navigator.of(context).pop(),
                  ),
                  const Spacer(),
                  if (widget.images.length > 1)
                    _GlassChip(
                      child: Text(
                        '\u2066${_index + 1} / ${widget.images.length}\u2069',
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Price card
// ─────────────────────────────────────────────────────────────────────────────

/// One small fact under the price ("المقدم 10%" · 485,000).
class AppPriceFact {
  const AppPriceFact(this.label, this.value);
  final String label;
  final String value;
}

/// The price of a unit or the starting price of a project, the star of the
/// page: a label, the price, an optional line under it ("أو من 40,400 ج.م
/// شهريًا"), up to three facts, and an optional button ("احسب قسطك").
class AppPriceCard extends StatelessWidget {
  const AppPriceCard({
    super.key,
    required this.label,
    required this.price,
    this.caption,
    this.facts = const [],
    this.actionLabel,
    this.actionIcon = Icons.calculate_outlined,
    this.onAction,
    this.footer,
  });

  final String label;
  final String price;
  final String? caption;
  final List<AppPriceFact> facts;
  final String? actionLabel;
  final IconData actionIcon;
  final VoidCallback? onAction;

  /// Extra content at the bottom (a progress bar…).
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      key: const Key('detail-price-card'),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: colors.hairline),
        boxShadow: const [BoxShadow(color: Color(0x290F1E33), blurRadius: 40, offset: Offset(0, 18))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(label, style: theme.textTheme.labelLarge?.copyWith(color: colors.inkMuted)),
          const SizedBox(height: 2),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              price,
              maxLines: 1,
              style: homeDisplay(27, colors.inkStrong),
            ),
          ),
          if (caption != null) ...[
            const SizedBox(height: 2),
            Text(
              caption!,
              key: const Key('detail-price-caption'),
              style: theme.textTheme.titleSmall?.copyWith(color: colors.success, fontWeight: FontWeight.w700),
            ),
          ],
          if (facts.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                for (var i = 0; i < facts.length; i++) ...[
                  if (i > 0) const SizedBox(width: AppSpacing.xs),
                  Expanded(child: _FactTile(fact: facts[i])),
                ],
              ],
            ),
          ],
          if (footer != null) ...[const SizedBox(height: AppSpacing.md), footer!],
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.md),
            OutlinedButton.icon(
              key: const Key('detail-price-action'),
              onPressed: onAction,
              icon: Icon(actionIcon, size: 18),
              label: Text(actionLabel!),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(46),
                foregroundColor: AppPalette.gold600,
                side: const BorderSide(color: AppPalette.gold400, width: 1.4),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
                textStyle: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FactTile extends StatelessWidget {
  const _FactTile({required this.fact});
  final AppPriceFact fact;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs + 2),
      decoration: BoxDecoration(color: homeTint(context), border: Border.all(color: homeTintBorder(context)), borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            fact.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(color: colors.inkMuted),
          ),
          const SizedBox(height: 2),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              fact.value,
              maxLines: 1,
              style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800, color: colors.inkStrong),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section tabs
// ─────────────────────────────────────────────────────────────────────────────

/// A section the tabs jump to: its label and the key on its first widget.
class AppSectionTab {
  const AppSectionTab(this.label, this.anchor);
  final String label;
  final GlobalKey anchor;
}

/// Tabs pinned under the page header ("نظرة عامة · المخطط · خطة الدفع ·
/// الموقع"): a tap scrolls to the section, and the tab of the section on
/// screen lights up while scrolling.
class AppSectionTabsSliver extends StatelessWidget {
  const AppSectionTabsSliver({super.key, required this.tabs});
  final List<AppSectionTab> tabs;

  static const double height = 50;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return SliverPersistentHeader(
      pinned: true,
      delegate: _TabsDelegate(tabs: tabs, pinnedAbove: top),
    );
  }
}

class _TabsDelegate extends SliverPersistentHeaderDelegate {
  const _TabsDelegate({required this.tabs, required this.pinnedAbove});
  final List<AppSectionTab> tabs;
  final double pinnedAbove;

  @override
  double get minExtent => AppSectionTabsSliver.height;
  @override
  double get maxExtent => AppSectionTabsSliver.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) =>
      _SectionTabs(tabs: tabs, pinnedAbove: pinnedAbove);

  @override
  bool shouldRebuild(_TabsDelegate old) => old.tabs != tabs || old.pinnedAbove != pinnedAbove;
}

class _SectionTabs extends StatefulWidget {
  const _SectionTabs({required this.tabs, required this.pinnedAbove});
  final List<AppSectionTab> tabs;
  final double pinnedAbove;

  @override
  State<_SectionTabs> createState() => _SectionTabsState();
}

class _SectionTabsState extends State<_SectionTabs> {
  int _active = 0;
  ScrollPosition? _position;
  bool _jumping = false;

  double get _line => widget.pinnedAbove + AppSectionTabsSliver.height;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final position = Scrollable.maybeOf(context)?.position;
    if (position != _position) {
      _position?.removeListener(_onScroll);
      _position = position?..addListener(_onScroll);
    }
  }

  @override
  void dispose() {
    _position?.removeListener(_onScroll);
    super.dispose();
  }

  void _onScroll() {
    if (_jumping) return;
    var active = 0;
    for (var i = 0; i < widget.tabs.length; i++) {
      final box = widget.tabs[i].anchor.currentContext?.findRenderObject() as RenderBox?;
      if (box == null || !box.attached) continue;
      final y = box.localToGlobal(Offset.zero).dy;
      if (y <= _line + 24) active = i;
    }
    if (active != _active && mounted) setState(() => _active = active);
  }

  Future<void> _go(int i) async {
    final position = _position;
    final box = widget.tabs[i].anchor.currentContext?.findRenderObject();
    if (position == null || box == null) return;
    final viewport = RenderAbstractViewport.maybeOf(box);
    if (viewport == null) return;
    final reveal = viewport.getOffsetToReveal(box, 0).offset;
    final target = (reveal - _line + AppSpacing.xs).clamp(position.minScrollExtent, position.maxScrollExtent);
    setState(() => _active = i);
    _jumping = true;
    await position.animateTo(target, duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic);
    _jumping = false;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      key: const Key('detail-section-tabs'),
      color: colors.canvas,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 8),
        itemCount: widget.tabs.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final selected = i == _active;
          return Material(
            color: selected ? AppPalette.navy : colors.surface,
            shape: StadiumBorder(side: BorderSide(color: selected ? AppPalette.navy : colors.hairline)),
            child: InkWell(
              key: Key('detail-tab-$i'),
              customBorder: const StadiumBorder(),
              onTap: () => _go(i),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Center(
                  child: Text(
                    widget.tabs[i].label,
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: selected ? Colors.white : colors.inkStrong),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment plans (the company's plans, as a customer or a broker reads them)
// ─────────────────────────────────────────────────────────────────────────────

extension InstallmentPeriodText on InstallmentPeriod {
  /// "شهريًا", "كل 3 أشهر"…
  String every(AppLocalizations l10n) => switch (this) {
        InstallmentPeriod.monthly => l10n.detailPeriodMonthly,
        InstallmentPeriod.quarterly => l10n.detailPeriodQuarterly,
        InstallmentPeriod.semiAnnual => l10n.detailPeriodSemiAnnual,
        InstallmentPeriod.yearly => l10n.detailPeriodYearly,
      };

  /// "القسط الشهري", "القسط ربع السنوي"…
  String instalment(AppLocalizations l10n) => switch (this) {
        InstallmentPeriod.monthly => l10n.detailInstallmentMonthly,
        InstallmentPeriod.quarterly => l10n.detailInstallmentQuarterly,
        InstallmentPeriod.semiAnnual => l10n.detailInstallmentSemiAnnual,
        InstallmentPeriod.yearly => l10n.detailInstallmentYearly,
      };
}

/// "8 سنوات" for whole years, else "18 شهرًا".
String durationText(AppLocalizations l10n, int months) =>
    months % 12 == 0 ? l10n.detailYears(months ~/ 12) : l10n.detailMonths(months);

/// The lowest instalment across [offers], as "أو من 40,400 ج.م شهريًا".
String? cheapestInstallmentLine(AppLocalizations l10n, String lang, List<InstallmentOffer> offers) {
  InstallmentOfferOption? best;
  for (final offer in offers) {
    final o = offer.cheapest;
    if (o != null && (best == null || InstallmentOffer.monthlyEquivalent(o) < InstallmentOffer.monthlyEquivalent(best))) best = o;
  }
  if (best == null) return null;
  return l10n.detailOrFrom(PriceFormatter.format(best.amount.round(), languageCode: lang), best.period.every(l10n));
}

/// A plan as a table: booking, down payment, the instalments of its longest
/// duration (or of [option]), the final payment and the total.
class AppPaymentPlanTable extends StatelessWidget {
  const AppPaymentPlanTable({super.key, required this.offer, this.option});
  final InstallmentOffer offer;
  final InstallmentOfferOption? option;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    String money(num v) => PriceFormatter.format(v.round(), languageCode: lang);
    final o = option ?? offer.longest;
    final rows = <(String, String)>[
      if (offer.booking > 0) (l10n.detailRowBooking, money(offer.booking)),
      if (offer.downPayment > 0) (offer.isCash ? l10n.detailCashPayment : l10n.detailRowDownPayment, money(offer.downPayment)),
      if (o != null) (l10n.detailRowInstallments(o.count), '${money(o.amount)} ${o.period.every(l10n)}'),
      if (offer.finalPayment > 0) (l10n.detailRowFinal, money(offer.finalPayment)),
    ];
    final total = o?.totalPayable ?? offer.netPrice;
    return Container(
      key: const Key('detail-plan-table'),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: colors.hairline.withValues(alpha: 0.8)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (final r in rows)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm + 2),
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.hairline.withValues(alpha: 0.6)))),
              child: Row(
                children: [
                  Expanded(child: Text(r.$1, style: theme.textTheme.bodyMedium?.copyWith(color: colors.ink))),
                  Text(r.$2, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700, color: colors.inkStrong)),
                ],
              ),
            ),
          Container(
            color: colors.surfaceSoft,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm + 2),
            child: Row(
              children: [
                Expanded(
                  child: Text(l10n.detailRowTotal,
                      style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700, color: colors.inkStrong)),
                ),
                Text(money(total),
                    style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800, color: colors.inkStrong)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// "مقدم 10% وتقسيط حتى 8 سنوات" for a project's price card, or null.
String? projectOfferLine(AppLocalizations l10n, ProjectPlanSummary plans) =>
    plans.minDownPaymentPercent != null && plans.maxMonths != null
        ? l10n.detailProjectOffer(percentLabel(plans.minDownPaymentPercent!), durationText(l10n, plans.maxMonths!))
        : null;

/// A project's payment offers as cards ("10% مقدم · حتى 8 سنوات"); the first
/// (lowest down payment) stands out in navy.
class AppPlanOfferCards extends StatelessWidget {
  const AppPlanOfferCards({super.key, required this.plans});
  final ProjectPlanSummary plans;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        for (var i = 0; i < plans.offers.length; i++)
          Builder(builder: (context) {
            final o = plans.offers[i];
            final strong = i == 0;
            final fg = strong ? Colors.white : colors.inkStrong;
            final sub = strong ? AppPalette.gold200 : colors.inkMuted;
            return Container(
              key: Key('project-offer-$i'),
              constraints: const BoxConstraints(minWidth: 150),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: strong ? AppPalette.navy : colors.surface,
                borderRadius: BorderRadius.circular(AppRadii.lg),
                border: strong ? null : Border.all(color: colors.hairline),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    o.isCash ? l10n.detailCashPayment : l10n.detailPlanTerm(percentLabel(o.downPaymentPercent)),
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: fg),
                  ),
                  if (!o.isCash && o.maxMonths > 0) ...[
                    const SizedBox(height: 2),
                    Text(l10n.detailUpTo(durationText(l10n, o.maxMonths)),
                        style: theme.textTheme.bodySmall?.copyWith(color: sub)),
                  ],
                ],
              ),
            );
          }),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculator
// ─────────────────────────────────────────────────────────────────────────────

/// "احسب قسطك": a sheet over the page to pick a plan and a duration and read
/// the instalment, worked out from the company's plans. [actions] go at the
/// bottom ("اطلب زيارة", "مشاركة مع عميل").
Future<void> showInstallmentCalculator(
  BuildContext context, {
  required String subtitle,
  required List<InstallmentOffer> offers,
  List<Widget> Function(BuildContext sheetContext)? actions,
}) {
  final withTerms = offers.where((o) => o.options.isNotEmpty).toList();
  if (withTerms.isEmpty) return Future.value();
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: context.appColors.canvas,
    builder: (sheetContext) => _CalculatorSheet(subtitle: subtitle, offers: withTerms, actions: actions),
  );
}

class _CalculatorSheet extends StatefulWidget {
  const _CalculatorSheet({required this.subtitle, required this.offers, this.actions});
  final String subtitle;
  final List<InstallmentOffer> offers;
  final List<Widget> Function(BuildContext sheetContext)? actions;

  @override
  State<_CalculatorSheet> createState() => _CalculatorSheetState();
}

class _CalculatorSheetState extends State<_CalculatorSheet> {
  int _plan = 0;
  int _option = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final colors = context.appColors;
    final theme = Theme.of(context);
    String money(num v) => PriceFormatter.format(v.round(), languageCode: lang);
    final offer = widget.offers[_plan];
    final option = offer.options[_option.clamp(0, offer.options.length - 1)];

    Widget label(String t) => Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
          child: Text(t, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: colors.inkStrong)),
        );

    Widget choices(List<String> labels, int selected, ValueChanged<int> onPick, String keyPrefix) => Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            for (var i = 0; i < labels.length; i++)
              ChoiceChip(
                key: Key('$keyPrefix-$i'),
                label: Text(labels[i]),
                selected: i == selected,
                showCheckmark: false,
                onSelected: (_) => onPick(i),
                selectedColor: colors.brandNavy,
                labelStyle: TextStyle(
                  color: i == selected ? Colors.white : colors.inkStrong,
                  fontWeight: i == selected ? FontWeight.w700 : FontWeight.w500,
                ),
                backgroundColor: colors.surface,
                side: BorderSide(color: i == selected ? colors.brandNavy : colors.hairline),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.sm + 2)),
              ),
          ],
        );

    final actions = widget.actions?.call(context) ?? const <Widget>[];
    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        key: const Key('installment-calculator'),
        padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(l10n.detailCalcInstallment,
                style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: colors.inkStrong)),
            const SizedBox(height: 2),
            Text(widget.subtitle, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted)),
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.all(AppSpacing.md + 2),
              decoration: BoxDecoration(color: AppPalette.navy, borderRadius: BorderRadius.circular(AppRadii.lg + 2)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(option.period.instalment(l10n), style: const TextStyle(color: Color(0xFFC9D2DE), fontSize: 13)),
                  const SizedBox(height: 4),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      money(option.amount),
                      key: const Key('calc-amount'),
                      style: theme.textTheme.headlineMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Container(height: 1, color: Colors.white.withValues(alpha: 0.14)),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      _CalcFact(label: l10n.detailCalcUpfront, value: money(offer.downPayment)),
                      _CalcFact(label: l10n.detailCalcCount, value: '${option.count}'),
                      _CalcFact(label: l10n.detailCalcTotal, value: money(option.totalPayable)),
                    ],
                  ),
                ],
              ),
            ),
            if (widget.offers.length > 1) ...[
              const SizedBox(height: AppSpacing.lg),
              label(l10n.detailCalcPlan),
              choices(
                [for (final o in widget.offers) ltrRuns(o.name)],
                _plan,
                (i) => setState(() {
                  _plan = i;
                  _option = 0;
                }),
                'calc-plan',
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            label(l10n.detailCalcDuration),
            choices(
              [for (final o in offer.options) durationText(l10n, o.durationMonths)],
              _option,
              (i) => setState(() => _option = i),
              'calc-duration',
            ),
            const SizedBox(height: AppSpacing.md),
            Text(l10n.detailCalcNote, style: theme.textTheme.bodySmall?.copyWith(color: colors.inkMuted, height: 1.6)),
            if (actions.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  for (var i = 0; i < actions.length; i++) ...[
                    if (i > 0) const SizedBox(width: AppSpacing.sm),
                    Expanded(child: actions[i]),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CalcFact extends StatelessWidget {
  const _CalcFact({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: Color(0xFFC9D2DE), fontSize: 12)),
            const SizedBox(height: 2),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: AlignmentDirectional.centerStart,
              child: Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom bar
// ─────────────────────────────────────────────────────────────────────────────

/// The bar fixed at the bottom of a detail page: an optional price on the
/// start side, then the actions (the last one is the main one).
class AppDetailBottomBar extends StatelessWidget {
  const AppDetailBottomBar({super.key, this.price, this.priceCaption, required this.children});
  final String? price;
  final String? priceCaption;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);
    return Container(
      key: const Key('detail-bottom-bar'),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.hairline)),
        boxShadow: [BoxShadow(color: AppPalette.navy.withValues(alpha: 0.08), blurRadius: 24, offset: const Offset(0, -8))],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.sm),
          child: Row(
            children: [
              if (price != null)
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (priceCaption != null)
                        Text(priceCaption!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.labelSmall?.copyWith(color: colors.inkMuted)),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: AlignmentDirectional.centerStart,
                        child: Text(price!,
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: colors.inkStrong)),
                      ),
                    ],
                  ),
                ),
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0 || price != null) const SizedBox(width: AppSpacing.xs + 2),
                price == null && children.length > 1 ? Expanded(child: children[i]) : children[i],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A main button of [AppDetailBottomBar] (gold, navy text).
class AppDetailPrimaryButton extends StatelessWidget {
  const AppDetailPrimaryButton({super.key, required this.label, required this.onPressed, this.icon});
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => FilledButton.icon(
        onPressed: onPressed,
        icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 18),
        label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 50),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          backgroundColor: AppPalette.gold400,
          foregroundColor: AppPalette.navy,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
          textStyle: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
        ),
      );
}

/// A secondary button of [AppDetailBottomBar] (outlined).
class AppDetailSecondaryButton extends StatelessWidget {
  const AppDetailSecondaryButton({super.key, required this.label, required this.onPressed, this.icon, this.color});
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.appColors.inkStrong;
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 18),
      label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 50),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
        foregroundColor: c,
        side: BorderSide(color: c, width: 1.4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
        textStyle: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      ),
    );
  }
}

/// An icon-only button of [AppDetailBottomBar] (WhatsApp…).
class AppDetailIconButton extends StatelessWidget {
  const AppDetailIconButton({super.key, required this.icon, required this.tooltip, required this.onPressed, this.color});
  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.appColors.success;
    return Tooltip(
      message: tooltip,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(50, 50),
          maximumSize: const Size(50, 50),
          padding: EdgeInsets.zero,
          foregroundColor: c,
          side: BorderSide(color: c, width: 1.4),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
        ),
        child: Icon(icon, size: 22, semanticLabel: tooltip),
      ),
    );
  }
}
