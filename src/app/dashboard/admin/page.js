import { redirect } from 'next/navigation';

export default function DeprecatedRootDashboard() {
  redirect('/admin/dashboard');
}