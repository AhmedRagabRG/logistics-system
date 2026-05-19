import { connection } from 'next/server';
import AdminsPage from './admins-client';

export default async function Page() {
  await connection();
  return <AdminsPage />;
}
