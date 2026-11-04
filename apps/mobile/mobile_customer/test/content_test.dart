import 'dart:convert';

import 'package:core/core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_customer/features/content/data/content_repository_impl.dart';
import 'package:mobile_customer/features/content/domain/content.dart';
import 'package:mobile_customer/features/content/presentation/content_widgets.dart';

/// CMS1 in the customer app: the company's banners and published pages.

class _Adapter implements HttpClientAdapter {
  _Adapter(this.bodies);
  final Map<String, Object?> bodies;
  final paths = <String>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, _, _) async {
    paths.add(options.path);
    return ResponseBody.fromString(jsonEncode(bodies[options.path]), 200, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });
  }

  @override
  void close({bool force = false}) {}
}

class _Repo implements ContentRepository {
  _Repo({this.bannerList = const [], this.pageList = const []});
  final List<ContentBanner> bannerList;
  final List<ContentPage> pageList;

  @override
  Future<Result<List<ContentBanner>>> banners() async => Ok(bannerList);

  @override
  Future<Result<List<ContentPage>>> pages() async => Ok(pageList);

  @override
  Future<Result<ContentPage>> page(String slug) async => Ok(ContentPage(
        slug: slug,
        title: const Translatable(ar: 'من نحن', en: 'About us'),
        body: const Translatable(ar: 'فقرة أولى.\n\nفقرة تانية.', en: 'First.\n\nSecond.'),
      ));
}

Widget _app(_Repo repo, Widget home, {List<String>? visited}) {
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => Scaffold(body: SingleChildScrollView(child: home))),
      GoRoute(
        path: '/projects/:id',
        builder: (_, s) {
          visited?.add('/projects/${s.pathParameters['id']}');
          return const Scaffold(body: Text('project'));
        },
      ),
      GoRoute(
        path: '/pages/:slug',
        builder: (_, s) {
          visited?.add('/pages/${s.pathParameters['slug']}');
          return ContentPageScreen(slug: s.pathParameters['slug']!);
        },
      ),
    ],
  );
  return RepositoryProvider<ContentRepository>.value(
    value: repo,
    child: MaterialApp.router(
      theme: ThemeData(extensions: [AppColorsExt.resolve(Brightness.light)]),
      locale: const Locale('ar'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: router,
    ),
  );
}

void main() {
  test('a banner opens the app screen for a page of the site, a web address outside', () {
    expect((bannerTarget('/projects/p1') as AppTarget).location, '/projects/p1');
    expect((bannerTarget('/units/u-9?ref=x') as AppTarget).location, '/units/u-9');
    expect((bannerTarget('/projects') as AppTarget).location, '/projects');
    expect((bannerTarget('/') as AppTarget).location, '/home');
    expect((bannerTarget('/pages/about') as AppTarget).location, '/pages/about');
    expect((bannerTarget('https://example.com/offer') as WebTarget).url, 'https://example.com/offer');
    // A site page with no app screen, or no link: the banner is not tappable.
    expect(bannerTarget('/contact'), isNull);
    expect(bannerTarget(null), isNull);
    expect(bannerTarget('javascript:alert(1)'), isNull);
  });

  test('a page body reads as headings, lists and paragraphs', () {
    final blocks = blocksOf('## رؤيتنا\nنبني مجتمعات.\n\n- مساكن\n- مدارس\n\nخدماتنا:\n\nسطر\nثاني');
    expect(blocks.map((b) => b.runtimeType.toString()), ['PageHeading', 'PageParagraph', 'PageBullets', 'PageHeading', 'PageParagraph']);
    expect((blocks[0] as PageHeading).text, 'رؤيتنا');
    expect((blocks[2] as PageBullets).items, ['مساكن', 'مدارس']);
    expect((blocks[3] as PageHeading).text, 'خدماتنا');
    expect((blocks[4] as PageParagraph).text, 'سطر ثاني');
  });

  test('each page gets its kind from its slug or title', () {
    PageKind k(String slug, String ar) => pageKindOf(ContentPage(slug: slug, title: Translatable(ar: ar, en: '')));
    expect(k('demo-about', 'من نحن'), PageKind.about);
    expect(k('p1', 'سياسة الخصوصية'), PageKind.privacy);
    expect(k('terms', 'الشروط والأحكام'), PageKind.terms);
    expect(k('x', 'أنظمة السداد'), PageKind.payment);
    expect(k('x', 'عروضنا'), PageKind.other);
  });

  test('a page body splits into paragraphs at blank lines', () {
    expect(paragraphsOf('one\r\n\r\ntwo\nstill two\n\n\n three '), ['one', 'two\nstill two', 'three']);
    expect(paragraphsOf('  '), isEmpty);
  });

  test('the repository reads the public endpoints', () async {
    final adapter = _Adapter({
      '/public/banners': [
        {'id': 'b1', 'imageUrl': 'https://x/1.jpg', 'title': 'عرض', 'link': '/projects/p1'},
      ],
      '/public/pages': [
        {'slug': 'about', 'title': {'ar': 'من نحن', 'en': 'About'}},
      ],
      '/public/pages/about': {'slug': 'about', 'title': 'من نحن', 'body': 'نص'},
    });
    final repo = ContentRepositoryImpl(Dio(BaseOptions(baseUrl: 'https://api.test'))..httpClientAdapter = adapter);
    expect((await repo.banners()).dataOrNull!.single.link, '/projects/p1');
    expect((await repo.pages()).dataOrNull!.single.title.ar, 'من نحن');
    expect((await repo.page('about')).dataOrNull!.body.ar, 'نص');
    expect(adapter.paths, ['/public/banners', '/public/pages', '/public/pages/about']);
  });

  testWidgets('no banners: nothing on the home screen', (t) async {
    await t.pumpWidget(_app(_Repo(), const HomeBanners()));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('home-banners')), findsNothing);
  });

  testWidgets('a banner shows its title and opens its project', (t) async {
    final visited = <String>[];
    await t.pumpWidget(_app(
      _Repo(bannerList: const [
        ContentBanner(id: 'b1', imageUrl: 'https://x/1.jpg', title: Translatable(ar: 'عرض الافتتاح', en: 'Launch'), link: '/projects/p1'),
        ContentBanner(id: 'b2', imageUrl: 'https://x/2.jpg', title: Translatable(ar: 'ثاني', en: 'Second')),
      ]),
      const HomeBanners(),
      visited: visited,
    ));
    await t.pump();
    await t.pump();
    expect(find.byKey(const Key('home-banners')), findsOneWidget);
    expect(find.text('عرض الافتتاح'), findsOneWidget);
    await t.tap(find.byKey(const ValueKey('banner-b1')));
    await t.pumpAndSettle();
    expect(visited, ['/projects/p1']);
  });

  testWidgets('the company pages open a page with its paragraphs', (t) async {
    final visited = <String>[];
    await t.pumpWidget(_app(
      _Repo(pageList: const [ContentPage(slug: 'about', title: Translatable(ar: 'من نحن', en: 'About us'))]),
      const CompanyPagesCard(title: 'عن الشركة'),
      visited: visited,
    ));
    await t.pump();
    await t.pump();
    expect(find.text('عن الشركة'), findsOneWidget);
    await t.tap(find.byKey(const ValueKey('page-about')));
    await t.pumpAndSettle();
    expect(visited, ['/pages/about']);
    expect(find.text('فقرة أولى.'), findsOneWidget);
    expect(find.text('فقرة تانية.'), findsOneWidget);
  });

  testWidgets('no published pages: no card', (t) async {
    await t.pumpWidget(_app(_Repo(), const CompanyPagesCard(title: 'عن الشركة')));
    await t.pumpAndSettle();
    expect(find.byKey(const Key('company-pages')), findsNothing);
  });
}
