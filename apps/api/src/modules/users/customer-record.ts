/** A buyer as the staff contract and booking views print them. */
export const CUSTOMER_RECORD_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  nationalId: true,
  address: true,
  birthDate: true,
  birthPlace: true,
  occupation: true,
  employer: true,
  nationalIdIssueDate: true,
  nationalIdIssuePlace: true,
  homePhone: true,
  customFields: true,
} as const;
