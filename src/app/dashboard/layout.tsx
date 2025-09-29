import type { ReactNode } from 'react'
import PanelLayout from '@/components/panel-layout'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <PanelLayout>{children}</PanelLayout>
}
