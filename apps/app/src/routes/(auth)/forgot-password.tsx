import { createFileRoute } from '@tanstack/react-router';
import AuthForgotPasswordPage from '@/features/auth/AuthForgotPasswordPage';

export const Route = createFileRoute('/(auth)/forgot-password')({
  head: () => ({ meta: [{ title: 'Forgot password — Nibleaf' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: AuthForgotPasswordPage,
});
