import 'package:core/core_domain.dart';

/// CMS1 in the customer app — what the company publishes on its website
/// (banners and pages), shown in the app too. Read-only and public.

class ContentBanner extends Equatable {
  const ContentBanner({required this.id, required this.imageUrl, required this.title, this.link});

  factory ContentBanner.fromJson(Map<String, dynamic> json) => ContentBanner(
        id: json['id'] as String,
        imageUrl: (json['imageUrl'] as String?) ?? '',
        title: Translatable.fromJson(json['title']),
        link: (json['link'] as String?)?.trim(),
      );

  final String id;
  final String imageUrl;
  final Translatable title;

  /// A page of the site ("/projects/…") or a web address.
  final String? link;

  @override
  List<Object?> get props => [id, imageUrl, title, link];
}

/// Where a banner's link leads in the app.
sealed class BannerTarget {
  const BannerTarget();
}

/// An app screen for the site page.
class AppTarget extends BannerTarget {
  const AppTarget(this.location);
  final String location;
}

/// A web address, opened outside the app.
class WebTarget extends BannerTarget {
  const WebTarget(this.url);
  final String url;
}

/// The site's pages that have an app screen; another site page has none.
BannerTarget? bannerTarget(String? link) {
  final l = link?.trim();
  if (l == null || l.isEmpty) return null;
  if (l.startsWith('http://') || l.startsWith('https://')) return WebTarget(l);
  if (!l.startsWith('/')) return null;
  final path = Uri.tryParse(l)?.path ?? l;
  const exact = {'/', '/projects', '/units'};
  if (exact.contains(path)) return AppTarget(path == '/' ? '/home' : path);
  final match = RegExp(r'^/(projects|units|pages)/([A-Za-z0-9_-]+)/?$').firstMatch(path);
  if (match != null) return AppTarget('/${match[1]}/${match[2]}');
  return null;
}

/// A body as the dashboard writes it: plain text, a blank line between paragraphs.
List<String> paragraphsOf(String body) => body
    .replaceAll('\r\n', '\n')
    .split(RegExp(r'\n\s*\n'))
    .map((p) => p.trim())
    .where((p) => p.isNotEmpty)
    .toList();

/// One piece of a page body: a heading, a bullet list or a paragraph.
sealed class PageBlock {
  const PageBlock();
}

class PageHeading extends PageBlock {
  const PageHeading(this.text);
  final String text;
}

class PageBullets extends PageBlock {
  const PageBullets(this.items);
  final List<String> items;
}

class PageParagraph extends PageBlock {
  const PageParagraph(this.text);
  final String text;
}

final _bullet = RegExp(r'^\s*(?:[-•*●▪]|\d+[.)])\s+');
final _heading = RegExp(r'^\s*#{1,3}\s+');

/// The body as blocks. Plain text from the dashboard: a blank line between
/// paragraphs, "# " starts a heading, and lines starting with "-", "•" or
/// "1." make a list. A one-line block ending with ":" reads as a heading too.
List<PageBlock> blocksOf(String body) {
  final blocks = <PageBlock>[];
  for (final chunk in paragraphsOf(body)) {
    final lines = chunk.split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty).toList();
    final para = <String>[];
    final bullets = <String>[];
    void flushPara() {
      if (para.isNotEmpty) blocks.add(PageParagraph(para.join(' ')));
      para.clear();
    }
    void flushBullets() {
      if (bullets.isNotEmpty) blocks.add(PageBullets(List.of(bullets)));
      bullets.clear();
    }
    for (final line in lines) {
      if (_heading.hasMatch(line)) {
        flushPara();
        flushBullets();
        blocks.add(PageHeading(line.replaceFirst(_heading, '')));
      } else if (_bullet.hasMatch(line)) {
        flushPara();
        bullets.add(line.replaceFirst(_bullet, ''));
      } else if (lines.length == 1 && line.endsWith(':') && line.length <= 60) {
        blocks.add(PageHeading(line.substring(0, line.length - 1).trim()));
      } else {
        flushBullets();
        para.add(line);
      }
    }
    flushPara();
    flushBullets();
  }
  return blocks;
}

/// What a page is about, from its slug and title, so the app can give it its
/// own icon and a line under its name.
enum PageKind { about, privacy, terms, payment, faq, contact, other }

PageKind pageKindOf(ContentPage page) {
  final t = '${page.slug} ${page.title.ar} ${page.title.en}'.toLowerCase();
  bool has(List<String> words) => words.any(t.contains);
  if (has(['privacy', 'خصوصي'])) return PageKind.privacy;
  if (has(['terms', 'condition', 'شروط', 'أحكام', 'احكام'])) return PageKind.terms;
  if (has(['payment', 'installment', 'سداد', 'تقسيط', 'دفع'])) return PageKind.payment;
  if (has(['faq', 'question', 'أسئلة', 'اسئلة'])) return PageKind.faq;
  if (has(['contact', 'تواصل', 'اتصل'])) return PageKind.contact;
  if (has(['about', 'من نحن', 'عن الشركة', 'نبذة'])) return PageKind.about;
  return PageKind.other;
}

class ContentPage extends Equatable {
  const ContentPage({required this.slug, required this.title, this.body = const Translatable(ar: '', en: '')});

  factory ContentPage.fromJson(Map<String, dynamic> json) => ContentPage(
        slug: (json['slug'] as String?) ?? '',
        title: Translatable.fromJson(json['title']),
        body: Translatable.fromJson(json['body']),
      );

  final String slug;
  final Translatable title;

  /// Empty in the list.
  final Translatable body;

  @override
  List<Object?> get props => [slug, title, body];
}

abstract interface class ContentRepository {
  Future<Result<List<ContentBanner>>> banners();
  Future<Result<List<ContentPage>>> pages();
  Future<Result<ContentPage>> page(String slug);
}
