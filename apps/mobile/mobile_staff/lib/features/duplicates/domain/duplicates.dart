import 'package:core/core.dart';

/// DUP1 in the staff app — the same customer with more than one open lead.
/// The admin, or a sales manager over their own team, keeps one and merges
/// the others into it (notes, calls, inquiries and visits move over).

class DuplicateLead extends Equatable {
  const DuplicateLead({
    required this.id,
    required this.stage,
    this.createdAt,
    this.ownerName,
    this.sourceName,
    this.campaignName,
    this.projectName,
    this.notes = 0,
    this.reservations = 0,
    this.brokerName,
    this.mergeable = true,
  });

  factory DuplicateLead.fromJson(Map<String, dynamic> json) {
    String? name(Object? v) => v is Map ? (v['ar'] ?? v['en']) as String? : v as String?;
    final count = json['_count'] as Map<String, dynamic>? ?? const {};
    final broker = json['broker'] as Map<String, dynamic>?;
    return DuplicateLead(
      id: json['id'] as String,
      stage: (json['stage'] as String?) ?? 'NEW',
      createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '')?.toLocal(),
      ownerName: (json['assignedSales'] as Map?)?['fullName'] as String?,
      sourceName: name((json['source'] as Map?)?['name']),
      campaignName: (json['campaign'] as Map?)?['name'] as String?,
      projectName: name((json['projectInterest'] as Map?)?['name']),
      notes: (count['notes'] as num?)?.toInt() ?? 0,
      reservations: (count['reservations'] as num?)?.toInt() ?? 0,
      brokerName: broker == null ? null : (broker['commercialName'] ?? broker['companyName'] ?? broker['code']) as String?,
      mergeable: json['mergeable'] != false,
    );
  }

  final String id;
  final String stage;
  final DateTime? createdAt;
  final String? ownerName;
  final String? sourceName;
  final String? campaignName;
  final String? projectName;
  final int notes;
  final int reservations;
  final String? brokerName;

  /// False with a reservation or a broker's credit: it can only be the one kept.
  final bool mergeable;

  @override
  List<Object?> get props => [id, stage, createdAt, ownerName, notes, reservations, brokerName, mergeable];
}

class DuplicateGroup extends Equatable {
  const DuplicateGroup({required this.clientId, required this.name, this.phone, this.email, this.leads = const []});

  factory DuplicateGroup.fromJson(Map<String, dynamic> json) {
    final client = json['client'] as Map<String, dynamic>? ?? const {};
    return DuplicateGroup(
      clientId: (client['id'] as String?) ?? '',
      name: (client['fullName'] as String?) ?? '',
      phone: client['phone'] as String?,
      email: client['email'] as String?,
      leads: ((json['leads'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(DuplicateLead.fromJson).toList(),
    );
  }

  final String clientId;
  final String name;
  final String? phone;
  final String? email;

  /// Oldest first.
  final List<DuplicateLead> leads;

  /// The lead kept by default, as on the dashboard: one that cannot be
  /// merged away, else the furthest along, else the oldest.
  DuplicateLead get suggestedKeep {
    final locked = leads.where((l) => !l.mergeable);
    if (locked.isNotEmpty) return locked.first;
    var best = leads.first;
    for (final l in leads) {
      if (stageRank(l.stage) > stageRank(best.stage)) best = l;
    }
    return best;
  }

  @override
  List<Object?> get props => [clientId, name, phone, leads];
}

int stageRank(String stage) => switch (stage) {
      'NEW' => 0,
      'INTERESTED' => 1,
      'VISIT' => 2,
      'NEGOTIATION' => 3,
      'WON' => 4,
      _ => -1,
    };

abstract interface class DuplicatesRepository {
  Future<Result<List<DuplicateGroup>>> list();

  /// Fold [duplicateIds] into [keepId].
  Future<Result<int>> merge(String keepId, List<String> duplicateIds);
}
