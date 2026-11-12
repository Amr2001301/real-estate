export interface GraphLead {
  id: string;
  created_time?: string;
  form_id?: string;
  platform?: string;
  field_data?: Array<{ name: string; values?: string[] }>;
}

export interface MappedLead {
  name: string;
  phone: string;
  email?: string;
  /** Every other answer the customer gave, as "question: answer" lines. */
  message?: string;
}

const pick = (fields: Map<string, string>, names: string[]) => {
  for (const n of names) {
    const v = fields.get(n);
    if (v) return v;
  }
  return undefined;
};

/**
 * A Meta lead form's answers as an intake lead. The standard fields are `full_name` (or first/last),
 * `phone_number` and `email`; whatever else the form asked is kept in the message.
 * Null when the form had no phone number — the lead cannot be reached or de-duplicated without one.
 */
export function mapGraphLead(lead: GraphLead): MappedLead | null {
  const fields = new Map<string, string>();
  for (const f of lead.field_data ?? []) {
    const v = f.values?.[0]?.trim();
    if (v) fields.set(f.name.toLowerCase(), v);
  }
  const phone = pick(fields, ['phone_number', 'phone', 'mobile_number', 'mobile']);
  if (!phone) return null;
  const first = fields.get('first_name');
  const last = fields.get('last_name');
  const name = pick(fields, ['full_name', 'name']) ?? ([first, last].filter(Boolean).join(' ') || 'عميل من فيسبوك');
  const email = pick(fields, ['email', 'work_email']);
  const used = new Set(['full_name', 'name', 'first_name', 'last_name', 'phone_number', 'phone', 'mobile_number', 'mobile', 'email', 'work_email']);
  const extra = [...fields.entries()]
    .filter(([k]) => !used.has(k))
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join(' — ');
  return { name: name.length < 2 ? 'عميل من فيسبوك' : name.slice(0, 120), phone, email, message: extra || undefined };
}
