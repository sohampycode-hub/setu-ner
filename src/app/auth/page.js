// src/app/auth/page.js
import { redirect } from 'next/navigation';

export default function AuthIndex() {
  redirect('/auth/login');
}