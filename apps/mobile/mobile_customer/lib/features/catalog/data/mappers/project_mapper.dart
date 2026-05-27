import '../../domain/entities/media_item.dart';
import '../../domain/entities/project.dart';
import '../dtos/media_dto.dart';
import '../dtos/project_dto.dart';

/// Maps project DTOs → domain entities.
extension MediaDtoMapper on MediaDto {
  MediaItem toEntity() => MediaItem(url: url, type: type, order: order);
}

extension ProjectListItemDtoMapper on ProjectListItemDto {
  ProjectListItem toEntity() => ProjectListItem(
        id: id,
        name: name,
        description: description,
        city: city,
        lat: lat,
        lng: lng,
        services: services,
        featured: featured,
        availableUnitsCount: availableUnitsCount,
        coverImage: coverImage,
      );
}

extension ProjectDetailDtoMapper on ProjectDetailDto {
  ProjectDetail toEntity() => ProjectDetail(
        id: id,
        name: name,
        description: description,
        city: city,
        lat: lat,
        lng: lng,
        services: services,
        featured: featured,
        media: media.map((m) => m.toEntity()).toList(),
        availableUnitsCount: availableUnitsCount,
      );
}
