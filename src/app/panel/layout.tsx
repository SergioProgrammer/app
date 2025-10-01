import type { ReactNode } from 'react'
import PanelLayout from '@/components/panel-layout'

export default function PanelRouteLayout({ children }: { children: ReactNode }) {
  return <PanelLayout>{children}</PanelLayout>
}

