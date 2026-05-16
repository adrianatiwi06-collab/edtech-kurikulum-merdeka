/**
 * Email Verification Pending Page
 * Shows after user signs up, waiting for email verification
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Force dynamic rendering to avoid prerender error with useSearchParams
export const dynamic = 'force-dynamic';

function VerifyEmailPendingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const userIdParam = searchParams.get('userId');
    
    if (emailParam) setEmail(emailParam);
    if (userIdParam) setUserId(userIdParam);
  }, [searchParams]);

  const handleResendEmail = async () => {
    setResending(true);
    setResendMessage('');
    setResendError('');

    try {
      const response = await fetch('/api/resend-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        setResendError(data.error || 'Failed to resend verification email');
      } else {
        setResendMessage('Verification email sent! Check your inbox (and spam folder).');
        setTimeout(() => setResendMessage(''), 5000);
      }
    } catch (error) {
      setResendError('Failed to resend email. Please try again.');
      console.error('Resend error:', error);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="text-center space-y-6">
          {/* Email Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          {/* Title & Description */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Verifikasi Email Anda
            </h1>
            <p className="text-gray-600 text-sm">
              Kami telah mengirimkan email verifikasi ke
            </p>
            <p className="text-blue-600 font-medium mt-1">
              {email || 'email Anda'}
            </p>
          </div>

          {/* Steps */}
          <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                1
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">Periksa Email</p>
                <p className="text-xs text-gray-600">Buka email dari EdTech Kurikulum Merdeka</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                2
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">Klik Link</p>
                <p className="text-xs text-gray-600">Klik tombol verifikasi di email</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                3
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">Selesai</p>
                <p className="text-xs text-gray-600">Akses dashboard setelah verifikasi</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          {resendMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700">{resendMessage}</p>
            </div>
          )}

          {resendError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{resendError}</p>
            </div>
          )}

          {/* Resend Button */}
          <Button
            onClick={handleResendEmail}
            disabled={resending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {resending ? 'Mengirim...' : 'Kirim Ulang Email'}
          </Button>

          {/* Help Text */}
          <div className="space-y-2 text-xs text-gray-600">
            <p>✓ Periksa folder Spam jika tidak ada email</p>
            <p>✓ Link verifikasi berlaku selama 24 jam</p>
            <p>✓ Hubungi support jika ada masalah</p>
          </div>

          {/* Footer Link */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-600 mb-3">
              Sudah selesai verifikasi?
            </p>
            <Link href="/dashboard">
              <Button className="w-full bg-gray-200 text-gray-900 hover:bg-gray-300">
                Lanjut ke Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function VerifyEmailPendingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <VerifyEmailPendingContent />
    </Suspense>
  );
}
