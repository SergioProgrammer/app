'use client'

import PanelLayout from '@/components/panel-layout'
import type { ReactNode } from 'react'

export default function VisionLayout({ children }: { children: ReactNode }) {
  return <PanelLayout>{children}</PanelLayout>
}
