// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Session _$SessionFromJson(Map<String, dynamic> json) => _Session(
  userId: json['userId'] as String,
  role: const AppRoleConverter().fromJson(json['role'] as String),
  email: json['email'] as String?,
  phone: json['phone'] as String?,
  displayName: json['displayName'] as String?,
);

Map<String, dynamic> _$SessionToJson(_Session instance) => <String, dynamic>{
  'userId': instance.userId,
  'role': const AppRoleConverter().toJson(instance.role),
  'email': instance.email,
  'phone': instance.phone,
  'displayName': instance.displayName,
};
