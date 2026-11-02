/// Reads a number from an API field that may come as a JSON number or as a
/// string. Money and other database decimals reach the apps as strings
/// ("113222.22") so they keep their exact value; counts come as numbers.
/// Null, an empty string or anything unreadable gives null.
double? readAmount(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value.trim());
  return null;
}
