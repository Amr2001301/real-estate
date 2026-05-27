import 'package:flutter/services.dart' show PlatformException;
import 'package:image_picker/image_picker.dart';

import 'photo_picker.dart';

/// `image_picker`-backed [PhotoPicker]. Down-scales/compresses on capture to
/// keep uploads small, and maps permission-denied platform errors to a typed
/// [PhotoPickerException] the cubit can localize.
class ImagePickerPhotoPicker implements PhotoPicker {
  ImagePickerPhotoPicker([ImagePicker? picker]) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  static const _maxDimension = 2000.0;
  static const _quality = 85;

  @override
  Future<List<PickedPhoto>> pickFromGallery({int? limit}) async {
    try {
      final files = await _picker.pickMultiImage(
        limit: limit,
        maxWidth: _maxDimension,
        maxHeight: _maxDimension,
        imageQuality: _quality,
      );
      return [for (final f in files) await _toPickedPhoto(f)];
    } on PlatformException catch (e) {
      throw PhotoPickerException(_kindFor(e));
    }
  }

  @override
  Future<PickedPhoto?> captureFromCamera() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.camera,
        maxWidth: _maxDimension,
        maxHeight: _maxDimension,
        imageQuality: _quality,
      );
      return file == null ? null : _toPickedPhoto(file);
    } on PlatformException catch (e) {
      throw PhotoPickerException(_kindFor(e));
    }
  }

  Future<PickedPhoto> _toPickedPhoto(XFile file) async {
    final bytes = await file.readAsBytes();
    return PickedPhoto(
      bytes: bytes,
      fileName: file.name,
      mimeType: file.mimeType ?? _mimeFromName(file.name),
      sizeBytes: bytes.length,
    );
  }

  /// Some platforms don't report a MIME type for gallery picks — infer it from
  /// the extension (limited to the image types we support).
  String _mimeFromName(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return '';
  }

  PhotoPickerErrorKind _kindFor(PlatformException e) {
    return e.code.contains('access_denied') || e.code.contains('permission')
        ? PhotoPickerErrorKind.permissionDenied
        : PhotoPickerErrorKind.unknown;
  }
}
