'use client';

import dynamic from 'next/dynamic';

// Dynamic import for Header to avoid SSR issues with wallet context
const Header = dynamic(() => import('@/components/Header').then((mod) => mod.Header), {
  ssr: false,
});

export function DynamicHeader() {
  return <Header />;
}
