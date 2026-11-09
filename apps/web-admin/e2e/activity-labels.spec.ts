import { test, expect } from '@playwright/test';
import { activityActionLabel, monthChartLabel } from '../src/lib/activity-labels';

// QA run 2, English sweep: the dashboard feed and its chart came from the API in Arabic.
test.describe('dashboard labels', () => {
  test('English labels each activity by its type; Arabic keeps the API text', () => {
    expect(activityActionLabel('contract', 'عقد جديد', 'en')).toBe('New contract');
    expect(activityActionLabel('deposit', 'دفعة جديدة', 'en')).toBe('New payment');
    expect(activityActionLabel('contract', 'عقد جديد', 'ar')).toBe('عقد جديد');
    expect(activityActionLabel('something-new', 'نص', 'en')).toBe('نص');
  });
  test('chart months are named from the month key in English', () => {
    expect(monthChartLabel('2026-11', 'نوفمبر', 'en')).toBe('November');
    expect(monthChartLabel('2026-01', 'يناير', 'en')).toBe('January');
    expect(monthChartLabel('2026-11', 'نوفمبر', 'ar')).toBe('نوفمبر');
    expect(monthChartLabel('bad', 'نوفمبر', 'en')).toBe('نوفمبر');
  });
});
