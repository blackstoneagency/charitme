import { requireUser } from '../../lib/auth';
import { getUserRoles } from '../../lib/roles';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser();
  const roles = await getUserRoles(user.id);

  return (
    <div className="container py-10">
      <h1 className="text-4xl font-black text-slate-950">Profile</h1>
      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-bold text-slate-500">Email</div>
        <div className="mt-1 text-lg font-black">{user.email}</div>
        <div className="mt-6 text-sm font-bold text-slate-500">Roles</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {roles.map((role) => <span key={role} className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700">{role}</span>)}
        </div>
      </div>
    </div>
  );
}
