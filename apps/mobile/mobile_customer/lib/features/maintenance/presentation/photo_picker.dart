import 'dart:typed_data';

/// A picked image, reduced to the plain data the upload flow needs. Keeps
/// `image_picker` (a platform plugin) out of the cubit so it stays testable.
class PickedPhoto {
  const PickedPhoto({
    required this.bytes,
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
  });

  final Uint8List bytes;
  final String fileName;

  /// Best-effort MIME type (may be empty when undetectable — the cubit then
  /// rejects it as an unsupported type).
  final String mimeType;
  final int sizeBytes;
}

/// Why a pick attempt failed, so the UI can show a friendly localized message.
enum PhotoPickerErrorKind { permissionDenied, unknown }

class PhotoPickerException implements Exception {
  const PhotoPickerException(this.kind);
  final PhotoPickerErrorKind kind;
}

/// Source-agnostic image picking. Implemented with `image_picker` for the app;
/// faked in tests.
abstract interface class PhotoPicker {
  /// Picks up to [limit] images from the gallery. Returns [] if the user
  /// cancels; throws [PhotoPickerException] on permission denial.
  Future<List<PickedPhoto>> pickFromGallery({int? limit});

  /// Captures a single photo with the camera. Returns null if the user
  /// cancels; throws [PhotoPickerException] on permission denial.
  Future<PickedPhoto?> captureFromCamera();
}
