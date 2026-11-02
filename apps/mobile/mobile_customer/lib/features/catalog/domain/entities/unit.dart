import 'package:core/core_domain.dart';

import 'catalog_enums.dart';
import 'media_item.dart';

/// Lightweight project reference embedded in a unit.
class UnitProjectRef extends Equatable {
  const UnitProjectRef({required this.id, required this.name, required this.city});

  final String id;
  final Translatable name;
  final String city;

  @override
  List<Object?> get props => [id, name, city];
}

/// A unit (apartment/villa/…) — domain entity. `price` is kept as the raw
/// decimal string from the backend; format it for display in presentation.
class Unit extends Equatable {
  const Unit({
    required this.id,
    required this.code,
    required this.type,
    this.typeName,
    required this.area,
    required this.bedrooms,
    required this.bathrooms,
    required this.price,
    required this.status,
    this.floor,
    this.coverImage,
    this.media = const [],
    this.project,
    this.specs = const UnitSpecs(),
  });

  final String id;
  final String code;
  final String type;

  /// The company's own name for the type, when it set one.
  final Translatable? typeName;
  final num area;
  final int bedrooms;
  final int bathrooms;
  final int? floor;
  final String price;
  final UnitStatus status;
  final String? coverImage;
  final List<MediaItem> media;
  final UnitProjectRef? project;

  /// Areas, finishing, view, orientation, handover (only those it has).
  final UnitSpecs specs;

  List<String> get galleryImages => imageUrls(media);

  /// The type as people read it ("فيلا", "شقة بغرفتي نوم"), never the code.
  String typeLabel(String languageCode) =>
      unitTypeLabel(type, languageCode: languageCode, name: typeName);
  num? get priceValue => num.tryParse(price);

  @override
  List<Object?> get props =>
      [id, code, type, area, bedrooms, bathrooms, price, status, specs];
}
