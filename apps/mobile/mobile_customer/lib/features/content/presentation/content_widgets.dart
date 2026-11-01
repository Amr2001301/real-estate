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

/// CMS1 — the company's published pages (about, terms…), as in the
/// website's footer. Nothing when there are none.
class CompanyPagesCard extends StatelessWidget {
  const CompanyPagesCard({super.key, this.title});

  /// A heading above the card.
  final String? title;

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
          final c = context.appColors;
          final lang = Localizations.localeOf(context).languageCode;
          return Column(
            key: const Key('company-pages'),
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (title != null) ...[
                Text(title!, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.inkMuted)),
                const SizedBox(height: AppSpacing.sm),
              ],
              Container(
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(AppRadii.lg),
                  border: Border.all(color: c.hairline.withValues(alpha: 0.6)),
                ),
                clipBehavior: Clip.antiAlias,
                child: Material(
                  color: Colors.transparent,
                  child: Column(
                    children: [
                      for (var i = 0; i < pages.length; i++) ...[
                        if (i > 0) Divider(height: 1, indent: AppSpacing.md, endIndent: AppSpacing.md, color: c.hairline),
                        ListTile(
                          key: ValueKey('page-${pages[i].slug}'),
                          leading: Icon(Icons.article_outlined, color: AppPalette.gold500),
                          title: Text(
                            pages[i].title.resolve(lang),
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.inkStrong),
                          ),
                          // Mirrors itself in Arabic.
                          trailing: Icon(Icons.chevron_right_rounded, color: c.inkMuted),
                          onTap: () => context.push('/pages/${pages[i].slug}'),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// One published page: its title and paragraphs.
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
          final c = context.appColors;
          return Scaffold(
            body: Column(
              children: [
                AppNavHeader(
                  title: page?.title.resolve(lang) ?? '',
                  compact: true,
                  leadingAction: NavHeaderAction(
                    icon: Icons.arrow_back_ios_new_rounded,
                    onTap: () => context.canPop() ? context.pop() : context.go('/home'),
                  ),
                ),
                Expanded(
                  child: switch (state.status) {
                    DataStatus.initial || DataStatus.loading => const Center(child: CircularProgressIndicator()),
                    DataStatus.failure => ErrorState(
                        failure: state.failure,
                        onRetry: context.read<LoadCubit<ContentPage>>().load,
                      ),
                    _ => ListView(
                        key: const Key('content-page'),
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.lg,
                          AppSpacing.lg,
                          AppSpacing.lg,
                          MediaQuery.paddingOf(context).bottom + AppSpacing.xl,
                        ),
                        children: [
                          for (final p in paragraphsOf(page!.body.resolve(lang)))
                            Padding(
                              padding: const EdgeInsets.only(bottom: AppSpacing.md),
                              child: Text(p, style: TextStyle(fontSize: 15, height: 1.8, color: c.ink)),
                            ),
                          if (paragraphsOf(page.body.resolve(lang)).isEmpty)
                            Text(l10n.contentPageEmpty, style: TextStyle(fontSize: 14, color: c.inkMuted)),
                        ],
                      ),
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
