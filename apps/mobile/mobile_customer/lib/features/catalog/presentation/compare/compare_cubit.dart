import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/unit.dart';

enum CompareToggle { added, removed, full }

/// Holds the locally-selected units to compare. App-wide (provided at the root)
/// so selections persist while browsing.
///
/// Compare is intentionally local: the public unit shape is self-contained, and
/// there is no batch `units?ids=` endpoint (see docs/mobile-backend-readiness).
class CompareCubit extends Cubit<List<Unit>> {
  CompareCubit() : super(const []);

  /// Hard upper bound — enforced here (not only in the UI) so no caller can add
  /// a 5th unit.
  static const maxItems = 4;

  /// Minimum selected units before a comparison is meaningful.
  static const minToCompare = 2;

  bool contains(String id) => state.any((u) => u.id == id);
  bool get isFull => state.length >= maxItems;

  /// True once enough units are selected to open the comparison.
  bool get canCompare => state.length >= minToCompare;

  CompareToggle toggle(Unit unit) {
    if (contains(unit.id)) {
      emit(state.where((u) => u.id != unit.id).toList());
      return CompareToggle.removed;
    }
    if (isFull) return CompareToggle.full;
    emit([...state, unit]);
    return CompareToggle.added;
  }

  void remove(String id) => emit(state.where((u) => u.id != id).toList());
  void clear() => emit(const []);
}
