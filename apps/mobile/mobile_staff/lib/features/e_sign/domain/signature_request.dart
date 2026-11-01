import 'dart:convert';
import 'dart:typed_data';

import 'package:core/core.dart';

/// P5 in the staff app — a booking form sent to the customer to sign online.
/// The API lays the form out (as it prints) and keeps it as sent; the link
/// is only ever shown when it is made.
class SignatureRequest extends Equatable {
  const SignatureRequest({
    required this.id,
    required this.state,
    this.createdAt,
    this.expiresAt,
    this.phone,
    this.signerName,
    this.signedAt,
    this.outdated = false,
    this.signature,
  });

  factory SignatureRequest.fromJson(Map<String, dynamic> json) {
    DateTime? at(Object? v) => v is String ? DateTime.tryParse(v)?.toLocal() : null;
    return SignatureRequest(
      id: json['id'] as String,
      state: (json['state'] as String?) ?? 'PENDING',
      createdAt: at(json['createdAt']),
      expiresAt: at(json['expiresAt']),
      phone: json['phone'] as String?,
      signerName: json['signerName'] as String?,
      signedAt: at(json['signedAt']),
      outdated: json['outdated'] == true,
      signature: json['signature'] as String?,
    );
  }

  final String id;

  /// PENDING, SIGNED, CANCELLED or EXPIRED.
  final String state;
  final DateTime? createdAt;
  final DateTime? expiresAt;

  /// The phone the code goes to, masked ("+20 ••• ••• 4567").
  final String? phone;
  final String? signerName;
  final DateTime? signedAt;

  /// The booking changed after the customer signed.
  final bool outdated;

  /// The drawn signature, a PNG data URL.
  final String? signature;

  bool get isPending => state == 'PENDING';
  bool get isSigned => state == 'SIGNED';

  /// The signature image's bytes, when it is a PNG data URL.
  Uint8List? get signatureBytes {
    final s = signature;
    if (s == null || !s.startsWith('data:image/png;base64,')) return null;
    try {
      return base64Decode(s.substring('data:image/png;base64,'.length));
    } on FormatException {
      return null;
    }
  }

  @override
  List<Object?> get props => [id, state, createdAt, expiresAt, phone, signerName, signedAt, outdated, signature];
}

/// A link just made: the request, and the link to send the customer.
class SentSignatureRequest extends Equatable {
  const SentSignatureRequest({required this.request, required this.url});
  final SignatureRequest request;
  final String url;

  @override
  List<Object?> get props => [request, url];
}

/// A booking can be sent while it is live.
bool bookingSignable(String status) => status == 'PENDING' || status == 'APPROVED';

abstract interface class SignatureRequestsRepository {
  /// A booking's requests, newest first.
  Future<Result<List<SignatureRequest>>> list(String reservationId);

  /// A new link; an open one stops working.
  Future<Result<SentSignatureRequest>> send(String reservationId, {required String locale});

  Future<Result<void>> cancel(String requestId);
}
