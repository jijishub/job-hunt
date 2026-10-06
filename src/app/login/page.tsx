'use client';

import React, { Suspense } from 'react';
import SSOLandingView from '@/components/SSOLandingView';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F9] flex items-center justify-center text-xs text-[#736A6D]">
          Loading Google SSO...
        </div>
      }
    >
      <SSOLandingView />
    </Suspense>
  );
}
