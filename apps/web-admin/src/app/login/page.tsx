import LoginForm from './form';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold mb-1 text-center">منصة إدارة العقارات</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">تسجيل دخول المسؤول / المبيعات</p>
        <LoginForm />
      </div>
    </div>
  );
}
