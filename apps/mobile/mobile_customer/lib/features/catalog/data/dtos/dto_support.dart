import 'package:core/core_domain.dart';

/// Parses a backend `{ ar, en }` (or plain localized string) payload into
/// [Translatable]. Delegates to the canonical [Translatable.fromJson] so every
/// feature shares one tolerant converter.
Translatable translatableFromJson(Object? json) => Translatable.fromJson(json);
