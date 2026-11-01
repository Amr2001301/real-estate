import 'package:core/core.dart';

/// MC1 in the staff app — the company's marketing campaigns: what each cost
/// and what it brought. Read here; set up and costed on the dashboard.

num? _num(Object? v) => v is num ? v : (v is String ? num.tryParse(v) : null);
String? _name(Object? v) => v is Map ? (v['ar'] ?? v['en']) as String? : v as String?;
DateTime? _day(Object? v) => v is String ? DateTime.tryParse(v) : null;

/// A campaign to pick when adding a lead.
class CampaignOption extends Equatable {
  const CampaignOption({required this.id, required this.name, required this.channel, required this.status});

  factory CampaignOption.fromJson(Map<String, dynamic> json) => CampaignOption(
        id: json['id'] as String,
        name: (json['name'] as String?) ?? '',
        channel: (json['channel'] as String?) ?? 'OTHER',
        status: (json['status'] as String?) ?? 'ACTIVE',
      );

  final String id;
  final String name;
  final String channel;
  final String status;

  @override
  List<Object?> get props => [id, name, channel, status];
}

class CampaignStats extends Equatable {
  const CampaignStats({
    this.leads = 0,
    this.qualified = 0,
    this.won = 0,
    this.lost = 0,
    this.spend = 0,
    this.cpl,
    this.cpa,
  });

  factory CampaignStats.fromJson(Map<String, dynamic>? json) => json == null
      ? const CampaignStats()
      : CampaignStats(
          leads: _num(json['leads'])?.toInt() ?? 0,
          qualified: _num(json['qualified'])?.toInt() ?? 0,
          won: _num(json['won'])?.toInt() ?? 0,
          lost: _num(json['lost'])?.toInt() ?? 0,
          spend: _num(json['spend']) ?? 0,
          cpl: _num(json['cpl']),
          cpa: _num(json['cpa']),
        );

  final int leads;
  final int qualified;
  final int won;
  final int lost;
  final num spend;

  /// Cost per lead / per sale; null without leads / sales.
  final num? cpl;
  final num? cpa;

  @override
  List<Object?> get props => [leads, qualified, won, lost, spend, cpl, cpa];
}

class CampaignSpend extends Equatable {
  const CampaignSpend({required this.id, required this.amount, this.spentOn, this.note});

  factory CampaignSpend.fromJson(Map<String, dynamic> json) => CampaignSpend(
        id: json['id'] as String,
        amount: _num(json['amount']) ?? 0,
        spentOn: _day(json['spentOn']),
        note: json['note'] as String?,
      );

  final String id;
  final num amount;

  /// A day (stored at UTC midnight).
  final DateTime? spentOn;
  final String? note;

  @override
  List<Object?> get props => [id, amount, spentOn, note];
}

/// Leads by the ad platform that brought them (null: not known).
class CampaignPlatform extends Equatable {
  const CampaignPlatform({this.platform, this.leads = 0, this.won = 0});

  factory CampaignPlatform.fromJson(Map<String, dynamic> json) => CampaignPlatform(
        platform: json['platform'] as String?,
        leads: _num(json['leads'])?.toInt() ?? 0,
        won: _num(json['won'])?.toInt() ?? 0,
      );

  final String? platform;
  final int leads;
  final int won;

  @override
  List<Object?> get props => [platform, leads, won];
}

class Campaign extends Equatable {
  const Campaign({
    required this.id,
    required this.name,
    required this.channel,
    required this.status,
    this.code,
    this.projectName,
    this.sourceName,
    this.budget,
    this.startsOn,
    this.endsOn,
    this.stats = const CampaignStats(),
    this.spend = const [],
    this.platforms = const [],
  });

  factory Campaign.fromJson(Map<String, dynamic> json) => Campaign(
        id: json['id'] as String,
        name: (json['name'] as String?) ?? '',
        channel: (json['channel'] as String?) ?? 'OTHER',
        status: (json['status'] as String?) ?? 'ACTIVE',
        code: json['code'] as String?,
        projectName: _name((json['project'] as Map?)?['name']),
        sourceName: _name((json['source'] as Map?)?['name']),
        budget: _num(json['budget']),
        startsOn: _day(json['startDate']),
        endsOn: _day(json['endDate']),
        stats: CampaignStats.fromJson(json['stats'] as Map<String, dynamic>?),
        spend: ((json['spend'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(CampaignSpend.fromJson).toList(),
        platforms:
            ((json['platforms'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(CampaignPlatform.fromJson).toList(),
      );

  final String id;
  final String name;
  final String channel;

  /// PLANNED, ACTIVE, PAUSED or ENDED.
  final String status;
  final String? code;
  final String? projectName;
  final String? sourceName;
  final num? budget;
  final DateTime? startsOn;
  final DateTime? endsOn;
  final CampaignStats stats;

  /// On the detail only.
  final List<CampaignSpend> spend;
  final List<CampaignPlatform> platforms;

  /// How much of the budget is spent (0–1+), when there is a budget.
  double? get budgetUsed => budget == null || budget! <= 0 ? null : stats.spend / budget!;

  @override
  List<Object?> get props => [id, name, channel, status, code, projectName, budget, stats, spend, platforms];
}

/// The list and its totals over every campaign shown.
class CampaignsPage extends Equatable {
  const CampaignsPage({this.items = const [], this.totals = const CampaignStats()});

  factory CampaignsPage.fromJson(Map<String, dynamic> json) => CampaignsPage(
        items: ((json['data'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(Campaign.fromJson).toList(),
        totals: CampaignStats.fromJson(json['totals'] as Map<String, dynamic>?),
      );

  final List<Campaign> items;
  final CampaignStats totals;

  @override
  List<Object?> get props => [items, totals];
}

const kCampaignStatuses = ['ACTIVE', 'PLANNED', 'PAUSED', 'ENDED'];

abstract interface class CampaignsRepository {
  /// For pickers: every campaign, live ones first.
  Future<Result<List<CampaignOption>>> options();
  Future<Result<CampaignsPage>> list({String? status});
  Future<Result<Campaign>> get(String id);
}
