/**
 * Shared column-header definitions for the catalogue import/export.
 *
 * Both `DataExportService` and `DataImportService` import from this file.
 * A header string that drifts between the two sides will cause the importer
 * to silently skip that column; keeping them here enforces that they stay
 * in sync at the module boundary.
 */

export const PROJECTS_SHEET = {
  name: 'Projects',
  headers: [
    '_Code',
    'اسم المشروع (AR)',
    'اسم المشروع (EN)',
    'الوصف (AR)',
    'الوصف (EN)',
    'المدينة',
    'الحالة',
    'تاريخ الإضافة (UTC)',
  ],
  widths: [16, 30, 30, 40, 40, 15, 15, 22],
  /** Maps logical field name → exact header string used in the file. */
  fields: {
    code:   '_Code',
    nameAr: 'اسم المشروع (AR)',
    nameEn: 'اسم المشروع (EN)',
    descAr: 'الوصف (AR)',
    descEn: 'الوصف (EN)',
    city:   'المدينة',
    status: 'الحالة',
    // 'تاريخ الإضافة (UTC)' is read-only; importer ignores it
  } as const,
} as const;

export const PHASES_SHEET = {
  name: 'Phases',
  headers: [
    '_ProjectCode',
    'اسم المشروع (AR)',
    'اسم المشروع (EN)',
    '_PhaseCode',
    'اسم المرحلة (AR)',
    'اسم المرحلة (EN)',
    'الترتيب',
    'تاريخ الإضافة (UTC)',
  ],
  widths: [16, 28, 28, 16, 28, 28, 10, 22],
  fields: {
    projectCode:  '_ProjectCode',
    projNameAr:   'اسم المشروع (AR)',
    projNameEn:   'اسم المشروع (EN)',
    code:         '_PhaseCode',
    nameAr:       'اسم المرحلة (AR)',
    nameEn:       'اسم المرحلة (EN)',
    order:        'الترتيب',
  } as const,
} as const;

export const BUILDINGS_SHEET = {
  name: 'Buildings',
  headers: [
    '_ProjectCode',
    'اسم المشروع (AR)',
    'اسم المشروع (EN)',
    '_PhaseCode',
    'اسم المرحلة (AR)',
    'اسم المرحلة (EN)',
    '_BuildingCode',
    'اسم المبنى',
    'الترتيب',
    'عدد الطوابق',
    'تاريخ الإضافة (UTC)',
  ],
  widths: [16, 25, 25, 16, 25, 25, 16, 20, 10, 12, 22],
  fields: {
    projectCode:  '_ProjectCode',
    projNameAr:   'اسم المشروع (AR)',
    projNameEn:   'اسم المشروع (EN)',
    phaseCode:    '_PhaseCode',
    phaseNameAr:  'اسم المرحلة (AR)',
    phaseNameEn:  'اسم المرحلة (EN)',
    code:         '_BuildingCode',
    name:         'اسم المبنى',
    order:        'الترتيب',
    totalFloors:  'عدد الطوابق',
  } as const,
} as const;

export const UNITS_SHEET = {
  name: 'Units',
  headers: [
    '_ProjectCode',
    'اسم المشروع (AR)',
    'اسم المشروع (EN)',
    '_PhaseCode',
    'اسم المرحلة (AR)',
    'اسم المرحلة (EN)',
    '_BuildingCode',
    'المبنى',
    'كود الوحدة',
    'النوع',
    'الطابق',
    'المساحة (م²)',
    'غرف النوم',
    'الحمامات',
    'السعر',
    'الحالة',
    'تاريخ الإضافة (UTC)',
  ],
  widths: [16, 25, 25, 16, 22, 22, 16, 18, 14, 12, 10, 12, 12, 12, 16, 14, 22],
  fields: {
    projectCode:   '_ProjectCode',
    projNameAr:    'اسم المشروع (AR)',
    projNameEn:    'اسم المشروع (EN)',
    phaseCode:     '_PhaseCode',
    phaseNameAr:   'اسم المرحلة (AR)',
    phaseNameEn:   'اسم المرحلة (EN)',
    buildingCode:  '_BuildingCode',
    buildingName:  'المبنى',
    code:          'كود الوحدة',
    type:          'النوع',
    floor:         'الطابق',
    area:          'المساحة (م²)',
    bedrooms:      'غرف النوم',
    bathrooms:     'الحمامات',
    price:         'السعر',
    status:        'الحالة',
  } as const,
} as const;

export const CUSTOMERS_SHEET = {
  name: 'Customers',
  headers: [
    'الاسم الكامل',
    'الهاتف',
    'البريد الإلكتروني',
    'اللغة المفضلة',
    'تاريخ التسجيل (UTC)',
  ],
  widths: [30, 18, 30, 14, 22],
  fields: {
    fullName: 'الاسم الكامل',
    phone:    'الهاتف',
    email:    'البريد الإلكتروني',
    locale:   'اللغة المفضلة',
    // 'تاريخ التسجيل (UTC)' is read-only; importer ignores it
  } as const,
} as const;

export const LEADS_SHEET = {
  name: 'Leads',
  headers: [
    '_ImportId',
    '_Ref',
    'الاسم الكامل',
    'الهاتف',
    'البريد الإلكتروني',
    'المرحلة',
    'المصدر',
    'مندوب المبيعات',
    'المشروع المهتم (AR)',
    'المشروع المهتم (EN)',
    'كود الوحدة المهتمة',
    'تاريخ الإضافة (UTC)',
    'آخر تحديث (UTC)',
  ],
  widths: [38, 10, 25, 16, 28, 14, 18, 22, 25, 25, 14, 22, 22],
  fields: {
    importId:        '_ImportId',
    fullName:        'الاسم الكامل',
    phone:           'الهاتف',
    email:           'البريد الإلكتروني',
    stage:           'المرحلة',
    source:          'المصدر',
    assignedSales:   'مندوب المبيعات',
    projectInterestAr: 'المشروع المهتم (AR)',
    projectInterestEn: 'المشروع المهتم (EN)',
    unitCode:        'كود الوحدة المهتمة',
    // '_Ref', 'تاريخ الإضافة (UTC)', 'آخر تحديث (UTC)' are read-only; importer ignores them
  } as const,
} as const;

/** Recognised sheet tab names that this importer handles. Order = processing order. */
export const HANDLED_SHEETS = [
  PROJECTS_SHEET.name,
  PHASES_SHEET.name,
  BUILDINGS_SHEET.name,
  UNITS_SHEET.name,
  CUSTOMERS_SHEET.name,
  LEADS_SHEET.name,
] as const;
