'use client';
import { Suspense } from 'react';
import EventPageContent from './EventPageContent';

export default function EventPage() {
  return (
    <Suspense fallback={<div>Loading event...</div>}>
      <EventPageContent />
    </Suspense>
  );
}