import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class ConnectivityState extends Equatable {
  const ConnectivityState({this.isConnected = true});
  final bool isConnected;

  @override
  List<Object?> get props => [isConnected];
}

class ConnectivityCubit extends Cubit<ConnectivityState> {
  ConnectivityCubit() : super(const ConnectivityState()) {
    _init();
  }

  StreamSubscription<List<ConnectivityResult>>? _sub;

  void _init() async {
    final results = await Connectivity().checkConnectivity();
    if (!isClosed) emit(ConnectivityState(isConnected: _hasConnection(results)));
    _sub = Connectivity().onConnectivityChanged.listen((results) {
      if (!isClosed) emit(ConnectivityState(isConnected: _hasConnection(results)));
    });
  }

  static bool _hasConnection(List<ConnectivityResult> results) =>
      results.any((r) => r != ConnectivityResult.none);

  @override
  Future<void> close() async {
    await _sub?.cancel();
    return super.close();
  }
}
