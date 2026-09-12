/**
 * Carry-forward B (MT-014): TENANT_SCOPED_MODELS moved to test-only fixture.
 *
 * This Set was the original manually-maintained list of tenant-owned models.
 * After MT-014, MODEL_TENANCY (model-tenancy.ts) is the authoritative source.
 * The equivalence test in mt014-model-tenancy-policy.spec.ts imports this
 * fixture to verify the two sets remain identical.
 *
 * DO NOT import this from production code — it is a historical snapshot only.
 */
export const TENANT_SCOPED_MODELS_LEGACY = new Set([
  // Projects / inventory
  'project', 'phase', 'building', 'unit', 'unitstatushistory', 'unitmaintenanceitem',
  // CRM
  'leadsource', 'lead', 'leadnote', 'leadactivity',
  // Requests / visits
  'inforequest', 'visitrequest', 'visitappointment', 'visitactivity',
  // Reservations / contracts / payments
  'reservation', 'reservationnote', 'reservationactivity',
  'contract', 'installmentplan', 'installment', 'deposit',
  // Plan templates
  'installmentplantemplate',
  // Bonus / targets
  'bonusrule', 'bonusentry', 'salestarget',
  // Maintenance
  'maintenancecategory', 'maintenancerequest', 'maintenancerequestitem',
  // CMS / notifications
  'cmspage', 'banner', 'article', 'notificationtemplate', 'notification', 'auditlog',
  // Brokers
  'broker', 'brokeruser', 'brokerprojectaccess', 'brokerunitaccess',
  'brokercommission', 'brokerpayout', 'brokeractivitylog',
  // Platform
  'setting', 'document',
  // Chat
  'chatsession', 'chatmessage', 'chatfeedback',
]);
