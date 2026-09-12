import { createFileRoute } from '@tanstack/react-router';
import AuthResetPasswordPage from '@/features/auth/AuthResetPasswordPage';

export const Route = createFileRoute('/(auth)/reset-password')({
  head: () => ({ meta: [{ title: 'Reset password — Nibleaf' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: AuthResetPasswordPage,
});
