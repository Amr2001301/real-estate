import 'package:core/core.dart';
import 'package:flutter/material.dart';

const _arMonths = [
  '', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const _enMonths = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/// Parses "YYYY-MM" → `(year, month)` tuple, or returns null on failure.
(int, int)? parsePeriod(String period) {
  final parts = period.split('-');
  if (parts.length != 2) return null;
  final y = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  if (y == null || m == null || m < 1 || m > 12) return null;
  return (y, m);
}

/// Formats "YYYY-MM" as a readable month+year label.
String periodLabel(String period, String lang) {
  final p = parsePeriod(period);
  if (p == null) return period;
  final (y, m) = p;
  final months = lang == 'ar' ? _arMonths : _enMonths;
  return '${months[m]} $y';
}

/// Shows a bottom-sheet period picker with year navigation and month grid.
/// Returns the selected "YYYY-MM" string, or null if dismissed.
Future<String?> showPeriodPicker(
  BuildContext context, {
  String? initialPeriod,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _PeriodPickerSheet(initialPeriod: initialPeriod),
  );
}

class _PeriodPickerSheet extends StatefulWidget {
  const _PeriodPickerSheet({this.initialPeriod});
  final String? initialPeriod;

  @override
  State<_PeriodPickerSheet> createState() => _PeriodPickerSheetState();
}

class _PeriodPickerSheetState extends State<_PeriodPickerSheet> {
  late int _year;
  late int _selectedMonth;
  late int _selectedYear;

  final _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    final p = widget.initialPeriod != null
        ? parsePeriod(widget.initialPeriod!)
        : null;
    _selectedYear = p?.$1 ?? _now.year;
    _selectedMonth = p?.$2 ?? _now.month;
    _year = _selectedYear;
  }

  String get _selectedPeriod =>
      '$_selectedYear-${_selectedMonth.toString().padLeft(2, '0')}';

  bool _isFuture(int year, int month) =>
      year > _now.year || (year == _now.year && month > _now.month);

  @override
  Widget build(BuildContext context) {
    final lang = Localizations.localeOf(context).languageCode;
    final months = lang == 'ar' ? _arMonths : _enMonths;
    final colors = context.appColors;
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius:
            const BorderRadius.vertical(top: Radius.circular(AppRadii.xxl)),
      ),
      padding: EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.lg, AppSpacing.lg,
          AppSpacing.lg + bottomPad),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.hairline,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          // Year navigation — LTR so left=previous, right=next always
          Directionality(
            textDirection: TextDirection.ltr,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _YearNavBtn(
                  icon: Icons.chevron_left_rounded,
                  onTap: () => setState(() => _year--),
                ),
                const SizedBox(width: AppSpacing.lg),
                Text(
                  '$_year',
                  style: Theme.of(context)
                      .textTheme
                      .headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(width: AppSpacing.lg),
                _YearNavBtn(
                  icon: Icons.chevron_right_rounded,
                  onTap: _year < _now.year
                      ? () => setState(() => _year++)
                      : null,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          // Month grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              childAspectRatio: 2.8,
              crossAxisSpacing: AppSpacing.sm,
              mainAxisSpacing: AppSpacing.sm,
            ),
            itemCount: 12,
            itemBuilder: (context, i) {
              final month = i + 1;
              final isFuture = _isFuture(_year, month);
              final isSelected =
                  _year == _selectedYear && month == _selectedMonth;

              return GestureDetector(
                onTap: isFuture
                    ? null
                    : () {
                        setState(() {
                          _selectedYear = _year;
                          _selectedMonth = month;
                        });
                        // Return immediately on tap
                        Navigator.of(context).pop(_selectedPeriod);
                      },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? colors.brandGold
                        : isFuture
                            ? colors.surfaceSoft
                            : colors.surface,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(
                      color: isSelected
                          ? colors.brandGold
                          : colors.hairline.withValues(alpha: 0.6),
                    ),
                  ),
                  child: Center(
                    child: Text(
                      months[month],
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: isSelected
                                ? Colors.white
                                : isFuture
                                    ? colors.inkMuted.withValues(alpha: 0.35)
                                    : colors.inkStrong,
                            fontWeight: isSelected
                                ? FontWeight.w700
                                : FontWeight.w500,
                          ),
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _YearNavBtn extends StatelessWidget {
  const _YearNavBtn({required this.icon, this.onTap});
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: enabled
              ? colors.brandGold.withValues(alpha: 0.10)
              : colors.surfaceSoft,
          shape: BoxShape.circle,
          border: Border.all(
            color: enabled
                ? colors.brandGold.withValues(alpha: 0.30)
                : colors.hairline,
          ),
        ),
        child: Icon(
          icon,
          size: 20,
          color: enabled ? colors.brandGold : colors.inkMuted.withValues(alpha: 0.35),
        ),
      ),
    );
  }
}
