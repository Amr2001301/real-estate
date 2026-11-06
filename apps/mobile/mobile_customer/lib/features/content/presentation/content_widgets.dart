import 'package:core/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../domain/content.dart';
import 'content_cubit.dart';

/// Opens what a banner points at: an app screen for a page of the site
/// that has one, a web address outside the app.
void openBanner(BuildContext context, ContentBanner b) {
  final target = bannerTarget(b.link);
  switch (target) {
    case AppTarget(:final location):
      // The tabs are switched to; a detail opens over them.
      const tabs = {'/home', '/projects', '/units'};
      tabs.contains(location) ? context.go(location) : context.push(location);
    case WebTarget(:final url):
      ContactActions.openExternal(url);
    case null:
      break;
  }
}

/// CMS1 — the company's banners on the home screen, as on its website
/// (active ones, in their order). Nothing while loading or when there are none.
class HomeBanners extends StatelessWidget {
  const HomeBanners({super.key, this.padding = EdgeInsets.zero});
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (ctx) => LoadCubit<List<ContentBanner>>(
        () => ctx.read<ContentRepository>().banners(),
        isEmpty: (l) => l.isEmpty,
      )..load(),
      child: BlocBuilder<LoadCubit<List<ContentBanner>>, LoadState<List<ContentBanner>>>(
        builder: (context, state) {
          final banners = (state.data ?? const <ContentBanner>[]).where((b) => b.imageUrl.isNotEmpty).toList();
          if (banners.isEmpty) return const SizedBox.shrink();
          return Padding(padding: padding, child: _Carousel(banners: banners));
        },
      ),
    );
  }
}

class _Carousel extends StatefulWidget {
  const _Carousel({required this.banners});
  final List<ContentBanner> banners;

  @override
  State<_Carousel> createState() => _CarouselState();
}

class _CarouselState extends State<_Carousel> {
  final _page = PageController();
  int _index = 0;

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final c = context.appColors;
    final banners = widget.banners;
    return Column(
      key: const Key('home-banners'),
      children: [
        AspectRatio(
          aspectRatio: 16 / 7,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.lg),
            child: PageView.builder(
              controller: _page,
              itemCount: banners.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (context, i) {
                final b = banners[i];
                final title = b.title.resolve(lang);
                final tappable = bannerTarget(b.link) != null;
                return GestureDetector(
                  key: ValueKey('banner-${b.id}'),
                  onTap: tappable ? () => openBanner(context, b) : null,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      AppNetworkImage(url: b.imageUrl),
                      if (title.isNotEmpty) ...[
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Colors.transparent, Color(0xB3000000)],
                              stops: [0.45, 1],
                            ),
                          ),
                        ),
                        PositionedDirectional(
                          start: AppSpacing.md,
                          end: AppSpacing.md,
                          bottom: AppSpacing.sm,
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  title,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700, height: 1.3),
                                ),
                              ),
                              if (tappable)
                                const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 14),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
          ),
        ),
        if (banners.length > 1) ...[
          const SizedBox(height: AppSpacing.xs),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < banners.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _index ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: i == _index ? AppPalette.gold500 : c.hairline,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

const _navyDeep = Color(0xFF0B1726);
const _navyLight = Color(0xFF243F62);

IconData _kindIcon(PageKind k) => switch (k) {
      PageKind.about => Icons.info_outline_rounded,
      PageKind.privacy => Icons.verified_user_outlined,
      PageKind.terms => Icons.gavel_rounded,
      PageKind.payment => Icons.payments_outlined,
      PageKind.faq => Icons.help_outline_rounded,
      PageKind.contact => Icons.support_agent_rounded,
      PageKind.other => Icons.article_outlined,
    };

String? _kindSubtitle(AppLocalizations l10n, PageKind k) => switch (k) {
      PageKind.about => l10n.pageKindAboutSub,
      PageKind.privacy => l10n.pageKindPrivacySub,
      PageKind.terms => l10n.pageKindTermsSub,
      PageKind.payment => l10n.pageKindPaymentSub,
      PageKind.faq => l10n.pageKindFaqSub,
      PageKind.contact => l10n.pageKindContactSub,
      PageKind.other => null,
    };

/// CMS1 — the company's published pages (about, terms…), as in the
/// website's footer, in the same card as «خدمات العميل»: each page with its
/// own icon and a line saying what it is. Nothing when there are none.
class CompanyPagesCard extends StatelessWidget {
  const CompanyPagesCard({super.key, this.title, this.horizontal = AppSpacing.md});

  /// A heading above the card.
  final String? title;

  /// The side space (0 where the page already pads its list).
  final double horizontal;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (ctx) => LoadCubit<List<ContentPage>>(
        () => ctx.read<ContentRepository>().pages(),
        isEmpty: (l) => l.isEmpty,
      )..load(),
      child: BlocBuilder<LoadCubit<List<ContentPage>>, LoadState<List<ContentPage>>>(
        builder: (context, state) {
          final pages = state.data ?? const <ContentPage>[];
          if (pages.isEmpty) return const SizedBox.shrink();
          final lang = Localizations.localeOf(context).languageCode;
          return KeyedSubtree(
            key: const Key('company-pages'),
            child: ProfileSection(
              horizontal: horizontal,
              icon: Icons.business_rounded,
              title: title ?? context.l10n.contentAboutCompany,
              items: [
                for (final page in pages)
                  ProfileItem(
                    id: 'page-${page.slug}',
                    icon: _kindIcon(pageKindOf(page)),
                    label: page.title.resolve(lang),
                    subtitle: _kindSubtitle(context.l10n, pageKindOf(page)),
                    onTap: () => context.push('/pages/${page.slug}'),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _GoldLabel extends StatelessWidget {
  const _GoldLabel({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    return Row(
      children: [
        Container(
          width: 3,
          height: 18,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppPalette.gold300, AppPalette.gold500],
            ),
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(color: c.inkStrong, fontWeight: FontWeight.w800),
        ),
      ],
    );
  }
}

/// One published page: the company's header (logo, name, the page's title),
/// the body as headings, lists and paragraphs in a reading card, then a
/// way to reach the company.
class ContentPageScreen extends StatelessWidget {
  const ContentPageScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BlocProvider(
      create: (ctx) => LoadCubit<ContentPage>(() => ctx.read<ContentRepository>().page(slug))..load(),
      child: BlocBuilder<LoadCubit<ContentPage>, LoadState<ContentPage>>(
        builder: (context, state) {
          final lang = Localizations.localeOf(context).languageCode;
          final page = state.data;
          final company = companyBrandOf(context).name;
          final back = NavHeaderAction(
            icon: Icons.arrow_back_rounded,
            onTap: () => context.canPop() ? context.pop() : context.go('/home'),
          );
          return Scaffold(
            body: switch (state.status) {
              DataStatus.initial || DataStatus.loading => Column(
                  children: [
                    AppNavHeader(title: '', compact: true, leadingAction: back),
                    const Expanded(child: Center(child: CircularProgressIndicator())),
                  ],
                ),
              DataStatus.failure => Column(
                  children: [
                    AppNavHeader(title: '', compact: true, leadingAction: back),
                    Expanded(
                      child: ErrorState(failure: state.failure, onRetry: context.read<LoadCubit<ContentPage>>().load),
                    ),
                  ],
                ),
              _ => ListView(
                  key: const Key('content-page'),
                  padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + AppSpacing.xl),
                  children: [
                    AppNavHeader(
                      title: page!.title.resolve(lang),
                      subtitle: company,
                      leadingAction: back,
                      avatarWidget: const BrandMark(size: 52),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, 0),
                      child: _PageBody(blocks: blocksOf(page.body.resolve(lang)), emptyText: l10n.contentPageEmpty),
                    ),
                    const Padding(
                      padding: EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, 0),
                      child: _ContactCard(),
                    ),
                  ],
                ),
            },
          );
        },
      ),
    );
  }
}

class _PageBody extends StatelessWidget {
  const _PageBody({required this.blocks, required this.emptyText});
  final List<PageBlock> blocks;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    final c = context.appColors;
    final body = TextStyle(fontSize: 15, height: 1.9, color: c.ink);
    final children = <Widget>[];
    for (final b in blocks) {
      if (children.isNotEmpty) children.add(const SizedBox(height: AppSpacing.md));
      children.add(switch (b) {
        PageHeading(:final text) => Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: _GoldLabel(title: text),
          ),
        PageBullets(:final items) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final item in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 11),
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(color: AppPalette.gold500, shape: BoxShape.circle),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(child: Text(item, style: body)),
                    ],
                  ),
                ),
            ],
          ),
        PageParagraph(:final text) => Text(text, style: body),
      });
    }
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.hairline.withValues(alpha: 0.45)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 14, offset: const Offset(0, 4))],
      ),
      child: blocks.isEmpty
          ? Text(emptyText, style: TextStyle(fontSize: 14, color: c.inkMuted))
          : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
    );
  }
}

/// The company's phone and WhatsApp, from its branding (as its website shows
/// them), or the build's numbers. Nothing when it has neither.
class _ContactCard extends StatelessWidget {
  const _ContactCard();

  @override
  Widget build(BuildContext context) {
    BrandTokens? tokens;
    try {
      tokens = context.watch<BrandingCubit>().state;
    } catch (_) {}
    EnvConfig? env;
    try {
      env = EnvConfig.current;
    } catch (_) {
      // Not set up (tests): the company's branding alone decides.
    }
    String? pick(String? a, String? b) =>
        (a != null && a.trim().isNotEmpty) ? a.trim() : ((b == null || b.isEmpty) ? null : b);
    final phone = pick(tokens?.contactPhone, env?.contactPhone);
    final whatsapp = pick(tokens?.contactWhatsApp, env?.whatsappNumber);
    if (phone == null && whatsapp == null) return const SizedBox.shrink();
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final c = context.appColors;
    return Container(
      key: const Key('content-contact'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppPalette.gold400.withValues(alpha: 0.45)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 14, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [_navyLight, _navyDeep], begin: Alignment.topLeft, end: Alignment.bottomRight),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.support_agent_rounded, size: 20, color: AppPalette.gold300),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.contentContactTitle,
                        style: theme.textTheme.titleMedium?.copyWith(color: c.inkStrong, fontWeight: FontWeight.w800)),
                    Text(l10n.contentContactSub, style: theme.textTheme.bodySmall?.copyWith(color: c.inkMuted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              if (phone != null)
                Expanded(
                  child: AppButton(
                    label: l10n.contentContactCall,
                    icon: Icons.call_rounded,
                    variant: AppButtonVariant.gold,
                    onPressed: () => ContactActions.call(phone),
                  ),
                ),
              if (phone != null && whatsapp != null) const SizedBox(width: AppSpacing.sm),
              if (whatsapp != null)
                Expanded(
                  child: AppButton(
                    label: l10n.contentContactWhatsApp,
                    icon: Icons.chat_rounded,
                    variant: AppButtonVariant.outline,
                    onPressed: () => ContactActions.whatsApp(number: whatsapp),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
