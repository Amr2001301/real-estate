import Link from 'next/link';
import ProjectForm from '../_form';

export default function NewProjectPage() {
  return (
    <div>
      <div className="mb-4">
        <Link href="/dashboard/projects" className="text-sm text-brand-600 hover:underline">
          ← العودة للمشاريع
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">مشروع جديد</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <ProjectForm />
      </div>
    </div>
  );
}
