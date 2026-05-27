// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'session_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

/// @nodoc
mixin _$SessionState {
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() unknown,
    required TResult Function(Session session) authenticated,
    required TResult Function() unauthenticated,
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? unknown,
    TResult? Function(Session session)? authenticated,
    TResult? Function()? unauthenticated,
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? unknown,
    TResult Function(Session session)? authenticated,
    TResult Function()? unauthenticated,
    required TResult orElse(),
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(SessionUnknown value) unknown,
    required TResult Function(SessionAuthenticated value) authenticated,
    required TResult Function(SessionUnauthenticated value) unauthenticated,
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(SessionUnknown value)? unknown,
    TResult? Function(SessionAuthenticated value)? authenticated,
    TResult? Function(SessionUnauthenticated value)? unauthenticated,
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(SessionUnknown value)? unknown,
    TResult Function(SessionAuthenticated value)? authenticated,
    TResult Function(SessionUnauthenticated value)? unauthenticated,
    required TResult orElse(),
  }) => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SessionStateCopyWith<$Res> {
  factory $SessionStateCopyWith(
    SessionState value,
    $Res Function(SessionState) then,
  ) = _$SessionStateCopyWithImpl<$Res, SessionState>;
}

/// @nodoc
class _$SessionStateCopyWithImpl<$Res, $Val extends SessionState>
    implements $SessionStateCopyWith<$Res> {
  _$SessionStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SessionState
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc
abstract class _$$SessionUnknownImplCopyWith<$Res> {
  factory _$$SessionUnknownImplCopyWith(
    _$SessionUnknownImpl value,
    $Res Function(_$SessionUnknownImpl) then,
  ) = __$$SessionUnknownImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$SessionUnknownImplCopyWithImpl<$Res>
    extends _$SessionStateCopyWithImpl<$Res, _$SessionUnknownImpl>
    implements _$$SessionUnknownImplCopyWith<$Res> {
  __$$SessionUnknownImplCopyWithImpl(
    _$SessionUnknownImpl _value,
    $Res Function(_$SessionUnknownImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of SessionState
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$SessionUnknownImpl extends SessionUnknown {
  const _$SessionUnknownImpl() : super._();

  @override
  String toString() {
    return 'SessionState.unknown()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType && other is _$SessionUnknownImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() unknown,
    required TResult Function(Session session) authenticated,
    required TResult Function() unauthenticated,
  }) {
    return unknown();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? unknown,
    TResult? Function(Session session)? authenticated,
    TResult? Function()? unauthenticated,
  }) {
    return unknown?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? unknown,
    TResult Function(Session session)? authenticated,
    TResult Function()? unauthenticated,
    required TResult orElse(),
  }) {
    if (unknown != null) {
      return unknown();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(SessionUnknown value) unknown,
    required TResult Function(SessionAuthenticated value) authenticated,
    required TResult Function(SessionUnauthenticated value) unauthenticated,
  }) {
    return unknown(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(SessionUnknown value)? unknown,
    TResult? Function(SessionAuthenticated value)? authenticated,
    TResult? Function(SessionUnauthenticated value)? unauthenticated,
  }) {
    return unknown?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(SessionUnknown value)? unknown,
    TResult Function(SessionAuthenticated value)? authenticated,
    TResult Function(SessionUnauthenticated value)? unauthenticated,
    required TResult orElse(),
  }) {
    if (unknown != null) {
      return unknown(this);
    }
    return orElse();
  }
}

abstract class SessionUnknown extends SessionState {
  const factory SessionUnknown() = _$SessionUnknownImpl;
  const SessionUnknown._() : super._();
}

/// @nodoc
abstract class _$$SessionAuthenticatedImplCopyWith<$Res> {
  factory _$$SessionAuthenticatedImplCopyWith(
    _$SessionAuthenticatedImpl value,
    $Res Function(_$SessionAuthenticatedImpl) then,
  ) = __$$SessionAuthenticatedImplCopyWithImpl<$Res>;
  @useResult
  $Res call({Session session});

  $SessionCopyWith<$Res> get session;
}

/// @nodoc
class __$$SessionAuthenticatedImplCopyWithImpl<$Res>
    extends _$SessionStateCopyWithImpl<$Res, _$SessionAuthenticatedImpl>
    implements _$$SessionAuthenticatedImplCopyWith<$Res> {
  __$$SessionAuthenticatedImplCopyWithImpl(
    _$SessionAuthenticatedImpl _value,
    $Res Function(_$SessionAuthenticatedImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of SessionState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? session = null}) {
    return _then(
      _$SessionAuthenticatedImpl(
        null == session
            ? _value.session
            : session // ignore: cast_nullable_to_non_nullable
                  as Session,
      ),
    );
  }

  /// Create a copy of SessionState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SessionCopyWith<$Res> get session {
    return $SessionCopyWith<$Res>(_value.session, (value) {
      return _then(_value.copyWith(session: value));
    });
  }
}

/// @nodoc

class _$SessionAuthenticatedImpl extends SessionAuthenticated {
  const _$SessionAuthenticatedImpl(this.session) : super._();

  @override
  final Session session;

  @override
  String toString() {
    return 'SessionState.authenticated(session: $session)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SessionAuthenticatedImpl &&
            (identical(other.session, session) || other.session == session));
  }

  @override
  int get hashCode => Object.hash(runtimeType, session);

  /// Create a copy of SessionState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SessionAuthenticatedImplCopyWith<_$SessionAuthenticatedImpl>
  get copyWith =>
      __$$SessionAuthenticatedImplCopyWithImpl<_$SessionAuthenticatedImpl>(
        this,
        _$identity,
      );

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() unknown,
    required TResult Function(Session session) authenticated,
    required TResult Function() unauthenticated,
  }) {
    return authenticated(session);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? unknown,
    TResult? Function(Session session)? authenticated,
    TResult? Function()? unauthenticated,
  }) {
    return authenticated?.call(session);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? unknown,
    TResult Function(Session session)? authenticated,
    TResult Function()? unauthenticated,
    required TResult orElse(),
  }) {
    if (authenticated != null) {
      return authenticated(session);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(SessionUnknown value) unknown,
    required TResult Function(SessionAuthenticated value) authenticated,
    required TResult Function(SessionUnauthenticated value) unauthenticated,
  }) {
    return authenticated(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(SessionUnknown value)? unknown,
    TResult? Function(SessionAuthenticated value)? authenticated,
    TResult? Function(SessionUnauthenticated value)? unauthenticated,
  }) {
    return authenticated?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(SessionUnknown value)? unknown,
    TResult Function(SessionAuthenticated value)? authenticated,
    TResult Function(SessionUnauthenticated value)? unauthenticated,
    required TResult orElse(),
  }) {
    if (authenticated != null) {
      return authenticated(this);
    }
    return orElse();
  }
}

abstract class SessionAuthenticated extends SessionState {
  const factory SessionAuthenticated(final Session session) =
      _$SessionAuthenticatedImpl;
  const SessionAuthenticated._() : super._();

  Session get session;

  /// Create a copy of SessionState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SessionAuthenticatedImplCopyWith<_$SessionAuthenticatedImpl>
  get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$SessionUnauthenticatedImplCopyWith<$Res> {
  factory _$$SessionUnauthenticatedImplCopyWith(
    _$SessionUnauthenticatedImpl value,
    $Res Function(_$SessionUnauthenticatedImpl) then,
  ) = __$$SessionUnauthenticatedImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$SessionUnauthenticatedImplCopyWithImpl<$Res>
    extends _$SessionStateCopyWithImpl<$Res, _$SessionUnauthenticatedImpl>
    implements _$$SessionUnauthenticatedImplCopyWith<$Res> {
  __$$SessionUnauthenticatedImplCopyWithImpl(
    _$SessionUnauthenticatedImpl _value,
    $Res Function(_$SessionUnauthenticatedImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of SessionState
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$SessionUnauthenticatedImpl extends SessionUnauthenticated {
  const _$SessionUnauthenticatedImpl() : super._();

  @override
  String toString() {
    return 'SessionState.unauthenticated()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SessionUnauthenticatedImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() unknown,
    required TResult Function(Session session) authenticated,
    required TResult Function() unauthenticated,
  }) {
    return unauthenticated();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? unknown,
    TResult? Function(Session session)? authenticated,
    TResult? Function()? unauthenticated,
  }) {
    return unauthenticated?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? unknown,
    TResult Function(Session session)? authenticated,
    TResult Function()? unauthenticated,
    required TResult orElse(),
  }) {
    if (unauthenticated != null) {
      return unauthenticated();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(SessionUnknown value) unknown,
    required TResult Function(SessionAuthenticated value) authenticated,
    required TResult Function(SessionUnauthenticated value) unauthenticated,
  }) {
    return unauthenticated(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(SessionUnknown value)? unknown,
    TResult? Function(SessionAuthenticated value)? authenticated,
    TResult? Function(SessionUnauthenticated value)? unauthenticated,
  }) {
    return unauthenticated?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(SessionUnknown value)? unknown,
    TResult Function(SessionAuthenticated value)? authenticated,
    TResult Function(SessionUnauthenticated value)? unauthenticated,
    required TResult orElse(),
  }) {
    if (unauthenticated != null) {
      return unauthenticated(this);
    }
    return orElse();
  }
}

abstract class SessionUnauthenticated extends SessionState {
  const factory SessionUnauthenticated() = _$SessionUnauthenticatedImpl;
  const SessionUnauthenticated._() : super._();
}
