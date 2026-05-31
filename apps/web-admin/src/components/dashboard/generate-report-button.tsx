import { ExportMenu } from '@/components/export-menu';

/**
 * P15.2 — the Admin Dashboard "توليد تقرير" control now delegates to the shared
 * ExportMenu: one click downloads the styled XLSX (default), and the caret menu
 * exposes the raw-data CSV fallback. Binary-safe download + friendly Arabic
 * error handling live in ExportMenu.
 */
export function GenerateReportButton() {
  return (
    <ExportMenu
      label="توليد تقرير"
      xlsxPath="/reports/admin-summary/export.xlsx"
      csvPath="/reports/admin-summary/export.csv"
      filenameBase="admin-summary"
    />
  );
}
