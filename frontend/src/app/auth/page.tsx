'use client';

import Link from 'next/link';

export default function AuthPage() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <div className="card w-full max-w-md">
        <div className="card-body">
          <h1 className="h2">Welcome back</h1>
          <p className="mt-1 muted">Choose a method to continue</p>

          <div className="mt-6 grid gap-3">
            <Link href="/login" className="btn btn-primary w-full">Continue with wallet</Link>
            <Link href="/signup" className="btn btn-ghost w-full">Create new account</Link>
          </div>

          <p className="mt-6 text-sm muted">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
