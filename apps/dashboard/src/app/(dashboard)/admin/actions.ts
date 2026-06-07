'use server';
import { setToken } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function impersonateSalon(token: string) {
  await setToken(token);
  redirect('/');
}
