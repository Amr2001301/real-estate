import 'package:core/core_domain.dart';

import '../../domain/entities/favorite.dart';
import '../dtos/favorite_dto.dart';

extension FavoriteDtoMapper on FavoriteDto {
  Favorite toEntity() {
    // Fall back to the subtitle (unit type / city) when no project name exists.
    final hasName = titleAr.isNotEmpty || titleEn.isNotEmpty;
    final title = hasName
        ? Translatable(ar: titleAr, en: titleEn)
        : Translatable(ar: subtitle ?? '', en: subtitle ?? '');
    return Favorite(
      id: id,
      targetId: targetId,
      isProject: isProject,
      title: title,
      subtitle: hasName ? subtitle : null,
      coverImage: coverImage,
    );
  }
}
