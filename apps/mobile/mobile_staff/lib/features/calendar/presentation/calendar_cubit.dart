import 'package:core/core.dart';
import 'package:flutter/material.dart' show DateUtils;
import 'package:flutter_bloc/flutter_bloc.dart';

import '../domain/calendar_event.dart';

class CalendarState extends Equatable {
  const CalendarState({
    required this.weekStart,
    required this.selected,
    this.status = DataStatus.initial,
    this.events = const [],
    this.failure,
  });

  /// The Saturday the shown week starts on.
  final DateTime weekStart;
  final DateTime selected;
  final DataStatus status;

  /// The week's entries, oldest first.
  final List<CalendarEvent> events;
  final AppFailure? failure;

  List<DateTime> get days => [for (var i = 0; i < 7; i++) DateTime(weekStart.year, weekStart.month, weekStart.day + i)];

  List<CalendarEvent> on(DateTime day) => events.where((e) => DateUtils.isSameDay(e.at, day)).toList();

  CalendarState copyWith({
    DateTime? weekStart,
    DateTime? selected,
    DataStatus? status,
    List<CalendarEvent>? events,
    AppFailure? failure,
  }) =>
      CalendarState(
        weekStart: weekStart ?? this.weekStart,
        selected: selected ?? this.selected,
        status: status ?? this.status,
        events: events ?? this.events,
        failure: failure ?? this.failure,
      );

  @override
  List<Object?> get props => [weekStart, selected, status, events, failure];
}

/// CAL1 — a week at a time, Saturday to Friday as in Egypt; opens on today.
class CalendarCubit extends Cubit<CalendarState> {
  CalendarCubit(this._repo, {DateTime Function() now = DateTime.now})
      : _now = now,
        super(_weekOf(DateUtils.dateOnly(now())));

  final CalendarRepository _repo;
  final DateTime Function() _now;

  static DateTime saturdayOf(DateTime day) {
    // DateTime.weekday: Monday 1 … Saturday 6, Sunday 7.
    final back = (day.weekday - DateTime.saturday + 7) % 7;
    return DateTime(day.year, day.month, day.day - back);
  }

  static CalendarState _weekOf(DateTime day) => CalendarState(weekStart: saturdayOf(day), selected: day);

  Future<void> load() => _loadWeek(state.weekStart);

  void select(DateTime day) => emit(state.copyWith(selected: DateUtils.dateOnly(day)));

  Future<void> shiftWeek(int weeks) async {
    final start = DateTime(state.weekStart.year, state.weekStart.month, state.weekStart.day + 7 * weeks);
    final today = DateUtils.dateOnly(_now());
    // The day picked: today if it falls in that week, else the same weekday.
    final selected = !today.isBefore(start) && today.isBefore(DateTime(start.year, start.month, start.day + 7))
        ? today
        : DateTime(start.year, start.month, start.day + state.selected.difference(state.weekStart).inDays);
    emit(state.copyWith(weekStart: start, selected: selected));
    await _loadWeek(start);
  }

  Future<void> goToday() async {
    final today = DateUtils.dateOnly(_now());
    final start = saturdayOf(today);
    if (start == state.weekStart) {
      select(today);
      return;
    }
    emit(state.copyWith(weekStart: start, selected: today));
    await _loadWeek(start);
  }

  Future<void> _loadWeek(DateTime start) async {
    emit(state.copyWith(status: DataStatus.loading));
    final result = await _repo.events(start, DateTime(start.year, start.month, start.day + 6));
    if (start != state.weekStart) return; // moved on meanwhile
    result.when(
      ok: (events) => emit(state.copyWith(status: DataStatus.success, events: events)),
      err: (failure) => emit(state.copyWith(status: DataStatus.failure, failure: failure)),
    );
  }
}
