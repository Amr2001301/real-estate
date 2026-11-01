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
