import 'package:core/core.dart';
import 'package:flutter/material.dart';

import '../leads/presentation/follow_up_labels.dart' show followUpDate;

/// BRK-6c — labels, colours and the small pieces the brokerage screens share.

String bxKind(AppLocalizations l, String k) => switch (k) {
      'PRIMARY' => l.bxKindPRIMARY,
      'RESALE' => l.bxKindRESALE,
      'RENT' => l.bxKindRENT,
      _ => k,
    };

/// A listing's state; «أُغلقت» says what closing meant for its kind.
String bxListingStatus(AppLocalizations l, String s, {String? kind}) => switch (s) {
      'AVAILABLE' => l.bxLstAVAILABLE,
      'UNDER_OFFER' => l.bxLstUNDER_OFFER,
      'CLOSED' => kind == 'RENT' ? l.bxLstRented : (kind == null ? l.bxLstCLOSED : l.bxLstSold),
      'WITHDRAWN' => l.bxLstWITHDRAWN,
      _ => s,
    };

Color bxListingColor(String s, AppColorsExt c) => switch (s) {
      'AVAILABLE' => c.success,
      'UNDER_OFFER' => c.warning,
      'CLOSED' => AppPalette.gold500,
      _ => c.inkMuted,
    };

String bxDealStatus(AppLocalizations l, String s) => switch (s) {
      'CLOSED' => l.bxDealCLOSED,
      'CANCELLED' => l.bxDealCANCELLED,
      _ => s,
    };

String bxClaimStatus(AppLocalizations l, String s) => switch (s) {
      'PENDING' => l.bxClaimPENDING,
      'SUBMITTED' => l.bxClaimSUBMITTED,
      'PARTIALLY_PAID' => l.bxClaimPARTIALLY_PAID,
      'PAID' => l.bxClaimPAID,
      'REJECTED' => l.bxClaimREJECTED,
      _ => s,
    };

Color bxClaimColor(String s, AppColorsExt c) => switch (s) {
      'PAID' => c.success,
      'PARTIALLY_PAID' || 'SUBMITTED' => c.warning,
      'REJECTED' => c.error,
      _ => c.inkMuted,
    };

String bxSplitRole(AppLocalizations l, String r) => r == 'MANAGER' ? l.bxRoleMANAGER : l.bxRoleAGENT;

String bxBonus(AppLocalizations l, String b) => switch (b) {
      'PENDING' => l.bxBonusPENDING,
      'EARNED' => l.bxBonusEARNED,
      'PAID' => l.bxBonusPAID,
      _ => l.bxBonusNONE,
    };

Color bxBonusColor(String b, AppColorsExt c) => switch (b) {
      'EARNED' => c.warning,
      'PAID' => c.success,
      _ => c.inkMuted,
    };

String bxLaunchStatus(AppLocalizations l, String s) => switch (s) {
      'UPCOMING' => l.bxLaunchUPCOMING,
      'OPEN' => l.bxLaunchOPEN,
      'CLOSED' => l.bxLaunchCLOSED,
      _ => s,
    };

Color bxLaunchColor(String s, AppColorsExt c) => switch (s) {
      'OPEN' => c.success,
      'UPCOMING' => c.info,
      _ => c.inkMuted,
    };

String bxEoiStatus(AppLocalizations l, String s) => switch (s) {
      'PENDING_PAYMENT' => l.bxEoiPENDING_PAYMENT,
      'PAID' => l.bxEoiPAID,
      'ALLOCATED' => l.bxEoiALLOCATED,
      'REFUNDED' => l.bxEoiREFUNDED,
      'CANCELLED' => l.bxEoiCANCELLED,
      _ => s,
    };

Color bxEoiColor(String s, AppColorsExt c) => switch (s) {
      'PENDING_PAYMENT' => c.warning,
      'PAID' => c.info,
      'ALLOCATED' => c.success,
      _ => c.inkMuted,
    };

/// Money with grouping and Western digits, no currency.
String bxMoney(num v) => ltr(catalogGrouped(v));

String bxDate(BuildContext context, DateTime? d) => d == null ? '—' : followUpDate(d, Localizations.localeOf(context).languageCode);

String bxCurrency(BuildContext context) => PriceFormatter.symbol(Localizations.localeOf(context).languageCode);

/// A figure and its currency, as on the other money cards.
class BxAmount extends StatelessWidget {
  const BxAmount(this.value, {super.key, this.size = 16, this.color});
  final num value;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Text.rich(TextSpan(children: [
      TextSpan(text: bxMoney(value), style: homeDisplay(size, color ?? colors.inkStrong)),
      TextSpan(text: ' ${bxCurrency(context)}', style: TextStyle(fontSize: 12, color: colors.inkMuted)),
    ]));
  }
}

/// The white card every row sits in, with the soft footer strip.
class BxCard extends StatelessWidget {
  const BxCard({super.key, required this.child, this.footer, this.onTap});
  final Widget child;
  final Widget? footer;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), border: Border.all(color: colors.hairline)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.fromLTRB(12, 12, 12, 11), child: child),
            if (footer != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
                decoration: BoxDecoration(color: colors.surfaceSoft, border: Border(top: BorderSide(color: colors.hairline))),
                child: footer,
              ),
          ]),
        ),
      ),
    );
  }
}

/// The square icon tile at the start of a card, tinted with the row's state.
class BxIconTile extends StatelessWidget {
  const BxIconTile(this.icon, this.color, {super.key, this.size = 44});
  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.13), borderRadius: BorderRadius.circular(14)),
        child: Icon(icon, color: color, size: size / 2),
      );
}

/// A collected-of-total bar, gold until it is full.
class BxProgress extends StatelessWidget {
  const BxProgress({super.key, required this.value, this.height = 6});

  /// 0..1.
  final double value;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final v = value.clamp(0.0, 1.0);
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: SizedBox(
        height: height,
        child: Stack(children: [
          Positioned.fill(child: ColoredBox(color: homeLine(context))),
          Positioned.fill(
            child: FractionallySizedBox(
              alignment: AlignmentDirectional.centerStart,
              widthFactor: v,
              heightFactor: 1,
              child: ColoredBox(color: v >= 1 ? colors.success : AppPalette.gold500),
            ),
          ),
        ]),
      ),
    );
  }
}

/// A label and its value on one line of a detail card.
class BxFactRow extends StatelessWidget {
  const BxFactRow(this.label, this.value, {super.key, this.strong = false, this.valueColor});
  final String label;
  final String value;
  final bool strong;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(flex: 4, child: Text(label, style: TextStyle(fontSize: 13, color: colors.inkMuted))),
        const SizedBox(width: 10),
        Expanded(
          flex: 6,
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: TextStyle(fontSize: 13.5, fontWeight: strong ? FontWeight.w800 : FontWeight.w600, color: valueColor ?? colors.inkStrong),
          ),
        ),
      ]),
    );
  }
}

/// A white card of fact rows split by hairlines.
class BxFacts extends StatelessWidget {
  const BxFacts({super.key, required this.rows});
  final List<Widget> rows;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: homeCard(context),
        child: Column(children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) Divider(height: 1, color: context.appColors.hairline),
            rows[i],
          ],
        ]),
      );
}

/// The muted line under a detail page: recording and editing are on the web.
class BxWebNote extends StatelessWidget {
  const BxWebNote({super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md, 18, AppSpacing.md, 0),
        child: Row(children: [
          Icon(Icons.desktop_windows_outlined, size: 16, color: context.appColors.inkMuted),
          const SizedBox(width: 8),
          Expanded(child: Text(context.l10n.bxWebOnly, style: TextStyle(fontSize: 12.5, color: context.appColors.inkMuted))),
        ]),
      );
}
