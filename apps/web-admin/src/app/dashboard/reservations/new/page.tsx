import { api, safe } from '@/lib/api';
import type { Paged, User, LeadStage, InstallmentPlanTemplate } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import NewReservationForm from './_form';

export const dynamic = 'force-dynamic';

interface AvailableUnit {
  id: string;
  code: string;
  type: string;
  // P8 — included so the form can preview the booking amount when the admin
  // chooses PERCENTAGE mode (preview = price × percent / 100). Backend
  // validates again; this is display-only.
  price?: string | number;
  building?: {
    phase?: { projectId?: string; project?: { id: string; name: { ar: string; en: string } } };
  };
}

interface LeadOption {
  id: string;
  fullName: string;
  phone: string;
  stage: LeadStage;
  projectInterest?: { id: string; name: { ar: string; en: string } } | null;
}

export default async function NewReservationPage() {
  const [unitsRes, leadsRes, clientsRes, customersRes, salesRes, plansRes] = await Promise.all([
    safe(api.get<Paged<AvailableUnit>>('/units?status=AVAILABLE&pageSize=200')),
    safe(api.get<Paged<LeadOption>>('/leads?pageSize=200')),
    safe(api.get<Paged<User>>('/users?role=CLIENT&pageSize=200')),
    safe(api.get<Paged<User>>('/users?role=CUSTOMER&pageSize=200')),
    safe(api.get<Paged<User>>('/users?role=SALES,SALES_MANAGER&pageSize=100')),
    safe(api.get<Paged<InstallmentPlanTemplate>>(
      '/installment-plan-templates?status=ACTIVE&pageSize=200',
    )),
  ]);

  const clients = [
    ...(clientsRes.data?.data ?? []),
    ...(customersRes.data?.data ?? []),
  ].map((u) => ({
    id: u.id,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role as 'CLIENT' | 'CUSTOMER',
  }));

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="إنشاء حجز جديد"
        description="أنشئ حجزاً جديداً وربطه بوحدة متاحة وعميل."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الحجوزات', href: '/dashboard/reservations' },
          { label: 'حجز جديد' },
        ]}
      />

      <NewReservationForm
        units={unitsRes.data?.data ?? []}
        leads={leadsRes.data?.data ?? []}
        clients={clients}
        salesOptions={salesRes.data?.data ?? []}
        plans={(plansRes.data?.data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          netPrice: p.netPrice,
          reservationAmount: p.reservationAmount,
          downPaymentAmount: p.downPaymentAmount,
          durationOptions: (p.durationOptions ?? []).map((o) => ({
            id: o.id,
            durationMonths: o.durationMonths,
            increasePercentage: o.increasePercentage,
          })),
          projectId: p.projectId,
          unitId: p.unitId,
        }))}
      />
    </div>
  );
}
