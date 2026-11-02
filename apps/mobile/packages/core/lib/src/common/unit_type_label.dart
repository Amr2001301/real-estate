import 'translatable.dart';

/// Names of the unit types every company starts with (the API's
/// `unit-type-defaults.ts`), by code. A company may rename them or add its
/// own; the API then sends the company's name as `typeName`.
const Map<String, ({String ar, String en})> _defaultUnitTypes = {
  'studio': (ar: 'استوديو', en: 'Studio'),
  '1br': (ar: 'شقة بغرفة نوم', en: '1-bedroom apartment'),
  '2br': (ar: 'شقة بغرفتي نوم', en: '2-bedroom apartment'),
  '3br': (ar: 'شقة بثلاث غرف نوم', en: '3-bedroom apartment'),
  '4br': (ar: 'شقة بأربع غرف نوم', en: '4-bedroom apartment'),
  'apartment': (ar: 'شقة', en: 'Apartment'),
  'duplex': (ar: 'دوبلكس', en: 'Duplex'),
  'penthouse': (ar: 'بنتهاوس', en: 'Penthouse'),
  'villa': (ar: 'فيلا', en: 'Villa'),
  'townhouse': (ar: 'تاون هاوس', en: 'Townhouse'),
  'twin house': (ar: 'توين هاوس', en: 'Twin house'),
  'chalet': (ar: 'شاليه', en: 'Chalet'),
  'shop': (ar: 'محل تجاري', en: 'Shop'),
  'retail': (ar: 'محل تجاري', en: 'Retail'),
  'office': (ar: 'مكتب إداري', en: 'Office'),
  'clinic': (ar: 'عيادة', en: 'Clinic'),
  'garage': (ar: 'جراج', en: 'Garage'),
};

/// A unit's type as people read it, as on the website: the company's own
/// name for the type when the API sent one ([name]: a `{ar, en}` map, a
/// [Translatable] or a string), else the name of a default type, else the
/// code itself. Empty when there is no type.
String unitTypeLabel(String? code, {required String languageCode, Object? name}) {
  final given = switch (name) {
    Translatable t => t.resolve(languageCode),
    Map m => Translatable.fromJson(m).resolve(languageCode),
    String s => s,
    _ => '',
  };
  if (given.trim().isNotEmpty) return given.trim();
  final c = (code ?? '').trim();
  if (c.isEmpty) return '';
  final known = _defaultUnitTypes[c.toLowerCase()];
  if (known == null) return c;
  return languageCode == 'ar' ? known.ar : known.en;
}
