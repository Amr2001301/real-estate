import 'package:core/core.dart';
import 'package:dio/dio.dart';

/// BRK-6c — what a brokerage company's staff see in the app: its listings,
/// its deals and the commission shares on them, the month's targets, and the
/// developers' launches it collects expressions of interest (EOIs) for.
/// The API keeps each role to its own rows (a rep sees their own, a manager
/// the team's, the admin all), so the app shows what comes back.

String _s(Object? v) => v is String ? v : (v == null ? '' : '$v');
String? _sn(Object? v) => v is String && v.trim().isNotEmpty ? v : null;
Map<String, dynamic> _m(Object? v) => v is Map<String, dynamic> ? v : const {};
DateTime? _at(Object? v) => v is String ? DateTime.tryParse(v)?.toLocal() : null;
double _n(Object? v) => readAmount(v) ?? 0;
int _i(Object? v) => (v as num?)?.toInt() ?? 0;
List<Map<String, dynamic>> _rows(Object? v) => (v as List? ?? const []).whereType<Map<String, dynamic>>().toList();

/// A name the API sends as a string, or as `{ar, en}` before it is flattened.
String _name(Object? v, String lang) => v is Map ? Translatable.fromJson(v).resolve(lang) : _s(v);

/// The counts by kind and by status that come with a list (`meta.facets.counts`).
Map<String, Map<String, int>> _counts(Map<String, dynamic> page) {
  final counts = _m(_m(_m(page['meta'])['facets'])['counts']);
  return {
    for (final e in counts.entries)
      e.key: {for (final c in _m(e.value).entries) c.key: _i(c.value)},
  };
}

const kListingKinds = ['PRIMARY', 'RESALE', 'RENT'];
const kListingStatuses = ['AVAILABLE', 'UNDER_OFFER', 'CLOSED', 'WITHDRAWN'];

class BxListing {
  const BxListing({
    required this.id,
    required this.code,
    required this.kind,
    required this.status,
    required this.title,
    required this.city,
    required this.area,
    required this.price,
    this.unitType,
    this.district,
    this.compound,
    this.developerName,
    this.projectName,
    this.bedrooms,
    this.bathrooms,
    this.floor,
    this.finishing,
    this.view,
    this.downPayment,
    this.deliveryDate,
    this.description,
    this.ownerName,
    this.ownerPhone,
    this.agentName,
  });

  final String id;
  final String code;
  final String kind;
  final String status;
  final String title;
  final String city;
  final double area;
  final double price;
  final String? unitType;
  final String? district;
  final String? compound;
  final String? developerName;
  final String? projectName;
  final int? bedrooms;
  final int? bathrooms;
  final int? floor;
  final String? finishing;
  final String? view;
  final double? downPayment;
  final DateTime? deliveryDate;
  final String? description;
  final String? ownerName;
  final String? ownerPhone;
  final String? agentName;

  /// Where it is: the compound or district, then the city.
  String get place => [compound, district, city].whereType<String>().where((p) => p.isNotEmpty).join('، ');

  factory BxListing.fromJson(Map<String, dynamic> j) => BxListing(
        id: _s(j['id']),
        code: _s(j['code']),
        kind: _s(j['kind']),
        status: _s(j['status']),
        title: _s(j['title']),
        city: _s(j['city']),
        area: _n(j['area']),
        price: _n(j['price']),
        unitType: _sn(j['unitType']),
        district: _sn(j['district']),
        compound: _sn(j['compound']),
        developerName: _sn(j['developerName']),
        projectName: _sn(j['projectName']),
        bedrooms: (j['bedrooms'] as num?)?.toInt(),
        bathrooms: (j['bathrooms'] as num?)?.toInt(),
        floor: (j['floor'] as num?)?.toInt(),
        finishing: _sn(j['finishing']),
        view: _sn(j['view']),
        downPayment: readAmount(j['downPayment']),
        deliveryDate: _at(j['deliveryDate']),
        description: _sn(j['description']),
        ownerName: _sn(j['ownerName']),
        ownerPhone: _sn(j['ownerPhone']),
        agentName: _sn(_m(j['agent'])['fullName']),
      );
}

class BxSplit {
  const BxSplit({required this.id, required this.role, required this.sharePct, required this.amount, this.paidAt, this.userName});
  final String id;

  /// `AGENT` | `MANAGER`.
  final String role;
  final double sharePct;
  final double amount;
  final DateTime? paidAt;
  final String? userName;

  factory BxSplit.fromJson(Map<String, dynamic> j) => BxSplit(
        id: _s(j['id']),
        role: _s(j['role']),
        sharePct: _n(j['sharePct']),
        amount: _n(j['amount']),
        paidAt: _at(j['paidAt']),
        userName: _sn(_m(j['user'])['fullName']),
      );
}

class BxDeal {
  const BxDeal({
    required this.id,
    required this.code,
    required this.kind,
    required this.status,
    required this.customerName,
    required this.dealValue,
    required this.closedOn,
    required this.commissionTotal,
    required this.commissionReceived,
    this.customerPhone,
    this.agentName,
    this.listingCode,
    this.listingTitle,
    this.claimCode,
    this.claimStatus,
    this.developerName,
    this.notes,
    this.cancelReason,
    this.coBrokerName,
    this.coBrokerPct,
    this.coBrokerAmount = 0,
    this.coBrokerPaidAt,
    this.splits = const [],
  });

  final String id;
  final String code;
  final String kind;

  /// `CLOSED` | `CANCELLED`.
  final String status;
  final String customerName;
  final String? customerPhone;
  final double dealValue;
  final DateTime? closedOn;
  final double commissionTotal;
  final double commissionReceived;
  final String? agentName;
  final String? listingCode;
  final String? listingTitle;
  final String? claimCode;
  final String? claimStatus;
  final String? developerName;
  final String? notes;
  final String? cancelReason;
  final String? coBrokerName;
  final double? coBrokerPct;
  final double coBrokerAmount;
  final DateTime? coBrokerPaidAt;
  final List<BxSplit> splits;

  double get outstanding => (commissionTotal - commissionReceived).clamp(0, double.infinity);
  bool get fullyCollected => commissionTotal > 0 && commissionReceived >= commissionTotal;

  factory BxDeal.fromJson(Map<String, dynamic> j) {
    final listing = _m(j['listing']);
    final claim = _m(j['claim']);
    return BxDeal(
      id: _s(j['id']),
      code: _s(j['code']),
      kind: _s(j['kind']),
      status: _s(j['status']),
      customerName: _s(j['customerName']),
      customerPhone: _sn(j['customerPhone']),
      dealValue: _n(j['dealValue']),
      closedOn: _at(j['closedOn']),
      commissionTotal: _n(j['commissionTotal']),
      commissionReceived: _n(j['commissionReceived']),
      agentName: _sn(_m(j['agent'])['fullName']),
      listingCode: _sn(listing['code']),
      listingTitle: _sn(listing['title']),
      claimCode: _sn(claim['code']),
      claimStatus: _sn(claim['status']),
      developerName: _sn(claim['developerName']),
      notes: _sn(j['notes']),
      cancelReason: _sn(j['cancelReason']),
      coBrokerName: _sn(j['coBrokerName']),
      coBrokerPct: readAmount(j['coBrokerPct']),
      coBrokerAmount: _n(j['coBrokerAmount']),
      coBrokerPaidAt: _at(j['coBrokerPaidAt']),
      splits: _rows(j['splits']).map(BxSplit.fromJson).toList(),
    );
  }
}

/// A page of deals with the figures over all of them (closed deals only).
class BxDealsPage {
  const BxDealsPage({required this.page, required this.counts, required this.commission, required this.received, required this.outstanding});
  final Paginated<BxDeal> page;
  final Map<String, Map<String, int>> counts;
  final double commission;
  final double received;
  final double outstanding;
}

/// One of the caller's commission shares, with the deal it is on.
class BxShare {
  const BxShare({
    required this.split,
    required this.payable,
    required this.dealId,
    required this.dealCode,
    required this.kind,
    required this.customerName,
    this.closedOn,
    this.listingTitle,
  });
  final BxSplit split;

  /// The developer paid the brokerage in full, so the share can be paid out.
  final bool payable;
  final String dealId;
  final String dealCode;
  final String kind;
  final String customerName;
  final DateTime? closedOn;
  final String? listingTitle;

  bool get paid => split.paidAt != null;

  factory BxShare.fromJson(Map<String, dynamic> j) {
    final deal = _m(j['deal']);
    return BxShare(
      split: BxSplit.fromJson(j),
      payable: j['payable'] == true,
      dealId: _s(deal['id']),
      dealCode: _s(deal['code']),
      kind: _s(deal['kind']),
      customerName: _s(deal['customerName']),
      closedOn: _at(deal['closedOn']),
      listingTitle: _sn(_m(deal['listing'])['title']),
    );
  }
}

class BxShares {
  const BxShares({required this.rows, required this.payable, required this.awaitingCollection, required this.paid});
  final List<BxShare> rows;
  final double payable;
  final double awaitingCollection;
  final double paid;
}

class BxTargetRow {
  const BxTargetRow({
    required this.userId,
    required this.userName,
    required this.role,
    required this.commission,
    required this.deals,
    required this.bonus,
    this.commissionTarget,
    this.dealsTarget,
    this.bonusAmount,
    this.commissionPct,
    this.dealsPct,
    this.achieved = false,
  });
  final String userId;
  final String userName;
  final String role;
  final double commission;
  final int deals;

  /// `NONE` | `PENDING` | `EARNED` | `PAID`.
  final String bonus;
  final double? commissionTarget;
  final int? dealsTarget;
  final double? bonusAmount;
  final int? commissionPct;
  final int? dealsPct;
  final bool achieved;

  bool get hasTarget => commissionTarget != null;

  factory BxTargetRow.fromJson(Map<String, dynamic> j) {
    final user = _m(j['user']);
    final target = j['target'] is Map ? _m(j['target']) : null;
    final actual = _m(j['actual']);
    final progress = j['progress'] is Map ? _m(j['progress']) : null;
    return BxTargetRow(
      userId: _s(user['id']),
      userName: _s(user['fullName']),
      role: _s(user['role']),
      commission: _n(actual['commission']),
      deals: _i(actual['deals']),
      bonus: _s(j['bonus']).isEmpty ? 'NONE' : _s(j['bonus']),
      commissionTarget: target == null ? null : _n(target['commissionTarget']),
      dealsTarget: target == null ? null : _i(target['dealsTarget']),
      bonusAmount: target == null ? null : _n(target['bonusAmount']),
      commissionPct: progress == null ? null : _i(progress['commissionPct']),
      dealsPct: progress == null ? null : _i(progress['dealsPct']),
      achieved: progress?['achieved'] == true,
    );
  }
}

class BxTargets {
  const BxTargets({required this.period, required this.rows, required this.achieved, required this.withTarget});

  /// "YYYY-MM".
  final String period;
  final List<BxTargetRow> rows;
  final int achieved;
  final int withTarget;
}

const kLaunchStatuses = ['UPCOMING', 'OPEN', 'CLOSED'];

class BxLaunch {
  const BxLaunch({
    required this.id,
    required this.name,
    required this.developerName,
    required this.status,
    required this.eoiAmount,
    this.launchDate,
    this.projectName,
    this.notes,
    this.total = 0,
    this.pending = 0,
    this.paid = 0,
    this.allocated = 0,
    this.refunded = 0,
    this.held = 0,
    this.queueLength = 0,
    this.eois = const [],
  });
  final String id;
  final String name;
  final String developerName;

  /// `UPCOMING` | `OPEN` | `CLOSED`.
  final String status;
  final double eoiAmount;
  final DateTime? launchDate;
  final String? projectName;
  final String? notes;
  final int total;
  final int pending;
  final int paid;
  final int allocated;
  final int refunded;

  /// The money held for the launch: paid and allocated EOIs.
  final double held;

  /// Paid EOIs waiting in the queue (the launch page).
  final int queueLength;
  final List<BxEoi> eois;

  factory BxLaunch.fromJson(Map<String, dynamic> j, String lang) {
    final counts = _m(j['counts']);
    return BxLaunch(
      id: _s(j['id']),
      name: _s(j['name']),
      developerName: _s(j['developerName']),
      status: _s(j['status']),
      eoiAmount: _n(j['eoiAmount']),
      launchDate: _at(j['launchDate']),
      projectName: j['developerProject'] is Map ? _sn(_name(_m(j['developerProject'])['name'], lang)) : null,
      notes: _sn(j['notes']),
      total: _i(counts['total']),
      pending: _i(counts['pending']),
      paid: _i(counts['paid']),
      allocated: _i(counts['allocated']),
      refunded: _i(counts['refunded']),
      held: _n(j['held']),
      queueLength: _i(j['queueLength']),
      eois: _rows(j['eois']).map(BxEoi.fromJson).toList(),
    );
  }
}

const kEoiStatuses = ['PENDING_PAYMENT', 'PAID', 'ALLOCATED', 'REFUNDED', 'CANCELLED'];

class BxEoi {
  const BxEoi({
    required this.id,
    required this.customerName,
    required this.customerPhone,
    required this.amount,
    required this.status,
    this.preference,
    this.budget,
    this.paidAt,
    this.paymentRef,
    this.allocation,
    this.queue,
    this.agentName,
  });
  final String id;
  final String customerName;
  final String customerPhone;
  final double amount;
  final String status;
  final String? preference;
  final double? budget;
  final DateTime? paidAt;
  final String? paymentRef;
  final String? allocation;

  /// The place in the launch's queue, for a paid EOI.
  final int? queue;
  final String? agentName;

  factory BxEoi.fromJson(Map<String, dynamic> j) => BxEoi(
        id: _s(j['id']),
        customerName: _s(j['customerName']),
        customerPhone: _s(j['customerPhone']),
        amount: _n(j['amount']),
        status: _s(j['status']),
        preference: _sn(j['preference']),
        budget: readAmount(j['budget']),
        paidAt: _at(j['paidAt']),
        paymentRef: _sn(j['paymentRef']),
        allocation: _sn(j['allocation']),
        queue: (j['queue'] as num?)?.toInt(),
        agentName: _sn(_m(j['agent'])['fullName']),
      );
}

/// "YYYY-MM" of a day.
String bxPeriod(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';

class BrokerageRepository {
  BrokerageRepository(this._dio);
  final Dio _dio;

  Future<Result<(Paginated<BxListing>, Map<String, Map<String, int>>)>> listings({String? kind, String? status, String? q, int page = 1}) =>
      guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/listings', queryParameters: {
          'page': page,
          'pageSize': 20,
          'kind': ?kind,
          'status': ?status,
          'q': ?(q?.trim().isNotEmpty == true ? q!.trim() : null),
        });
        final body = res.data ?? const <String, dynamic>{};
        return (Paginated.fromJson(body, BxListing.fromJson), _counts(body));
      });

  Future<Result<BxListing>> listing(String id) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/listings/$id');
        return BxListing.fromJson(res.data ?? const {});
      });

  Future<Result<BxDealsPage>> deals({String? status, String? kind, String? q, int page = 1}) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/deals', queryParameters: {
          'page': page,
          'pageSize': 20,
          'status': ?status,
          'kind': ?kind,
          'q': ?(q?.trim().isNotEmpty == true ? q!.trim() : null),
        });
        final body = res.data ?? const <String, dynamic>{};
        final sums = _m(_m(_m(body['meta'])['facets'])['sums']);
        return BxDealsPage(
          page: Paginated.fromJson(body, BxDeal.fromJson),
          counts: _counts(body),
          commission: _n(sums['commission']),
          received: _n(sums['received']),
          outstanding: _n(sums['outstanding']),
        );
      });

  Future<Result<BxDeal>> deal(String id) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/deals/$id');
        return BxDeal.fromJson(res.data ?? const {});
      });

  /// The caller's shares (the API keeps a rep to their own, a manager to the team's).
  Future<Result<BxShares>> shares({String? userId}) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/deals/splits', queryParameters: {'userId': ?userId});
        final body = res.data ?? const <String, dynamic>{};
        final totals = _m(body['totals']);
        return BxShares(
          rows: _rows(body['data']).map(BxShare.fromJson).toList(),
          payable: _n(totals['payable']),
          awaitingCollection: _n(totals['awaitingCollection']),
          paid: _n(totals['paid']),
        );
      });

  Future<Result<BxTargets>> targets({String? period}) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/deals/targets', queryParameters: {'period': ?period});
        final body = res.data ?? const <String, dynamic>{};
        final totals = _m(body['totals']);
        return BxTargets(
          period: _s(body['period']),
          rows: _rows(body['rows']).map(BxTargetRow.fromJson).toList(),
          achieved: _i(totals['achieved']),
          withTarget: _i(totals['withTarget']),
        );
      });

  Future<Result<List<BxLaunch>>> launches(String lang) => guardApiCall(() async {
        final res = await _dio.get<Object>('/launches');
        final body = res.data;
        final list = body is List ? body : _m(body)['data'];
        return _rows(list).map((j) => BxLaunch.fromJson(j, lang)).toList();
      });

  Future<Result<BxLaunch>> launch(String id, String lang) => guardApiCall(() async {
        final res = await _dio.get<Map<String, dynamic>>('/launches/$id');
        return BxLaunch.fromJson(res.data ?? const {}, lang);
      });
}
