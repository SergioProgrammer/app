import type { User } from '@supabase/supabase-js'
import type { LucideIcon } from 'lucide-react'
import {
  MessageCircle,
  ShieldCheck,
  CloudRain,
  Users,
  Database,
  FileSpreadsheet,
  Sun,
  Thermometer,
  Tractor,
  MapPin,
  Droplet,
  Megaphone,
} from 'lucide-react'

export interface AutomationTemplate {
  id: string
  name: string
  description: string
  icon: LucideIcon
  accentBg: string
  accentIcon: string
  href: string
  badges?: string[]
}

export interface DetailCTA {
  primaryLabel?: string
  primaryHref?: string
  secondaryLabel?: string
  secondaryHref?: string
  finalTitle?: string
  finalSubtitle?: string
}

export interface DetailMetric {
  label: string
  value: string
  caption?: string
}

export interface DetailHero {
  badge?: string
  title: string
  description: string
  highlights?: string[]
  panelCopy?: string
  metrics?: DetailMetric[]
}

export interface DetailSectionItem {
  title: string
  description: string
  tags?: string[]
  step?: string
}

type SectionLayout = 'timeline' | 'grid'

export interface DetailSection {
  title: string
  subtitle?: string
  layout?: SectionLayout
  items?: DetailSectionItem[]
  callout?: string
}

export interface DetailPricingTier {
  name: string
  description: string
  price: string
  users?: string
  includes: string[]
  highlight?: boolean
}

export interface DetailPricingOffline {
  description: string
  extraLabel: string
  price: string
}

export interface DetailPricing {
  tiers?: DetailPricingTier[]
  offline?: DetailPricingOffline
  customCopy?: string
}

export interface AutomationDetail {
  hero: DetailHero
  sections?: DetailSection[]
  pricing?: DetailPricing
  cta?: DetailCTA
}

export interface PanelConfig {
  slug: string
  label: string
  detail: AutomationDetail
  templates: AutomationTemplate[]
  plans?: PanelPlanConfig[]
}

export type PanelDatasetType = 'turnos'

export interface PanelPlanResource {
  label: string
  href?: string
  variant?: 'download' | 'view'
}

export interface PanelPlanDatasetConfig {
  type: PanelDatasetType
  table: string
  emailColumn?: string
  orderBy?: {
    column: string
    ascending?: boolean
  }
}

export interface PanelPlanConfig {
  id: string
  name: string
  summary?: string
  description?: string
  resources?: PanelPlanResource[]
  dataset?: PanelPlanDatasetConfig
}

const generalDetail: AutomationDetail = {
  hero: {
    badge: 'Oficina agronómica',
    title: 'Orquesta tu finca con el Agente que entiende tu campo',
    description:
      'Envía un audio desde el tractor, el invernadero o el despacho. El agente IA transcribe, entiende y activa los flujos correctos para cuadrillas, inventario y trazabilidad en segundos.',
    highlights: [
      'Procesa órdenes por WhatsApp, Telegram o llamada con detección de idioma real',
      'Funciona sin cobertura; sincroniza cuando vuelve la señal',
      'Registra tareas directamente en cuadernos, inventario y planes fitosanitarios',
    ],
    panelCopy:
      'Desde este panel sigues cada instrucción enviada al agente, validas los registros creados y priorizas labores críticas por cultivo o parcela en tiempo real.',
    metrics: [
      { label: 'Órdenes de campo procesadas', value: '2.4K', caption: 'Promedio mensual en cooperativas' },
      { label: 'Instrucciones por audio', value: '68%', caption: 'Se registran sin escribir notas' },
      { label: 'Cuadrillas sincronizadas', value: '35', caption: 'Equipos conectados por finca' },
      { label: 'Horas técnicas ahorradas', value: '12h', caption: 'Por semana en campañas intensivas' },
    ],
  },
  sections: [
    {
      title: 'Cómo funciona en campo',
      subtitle: 'Del audio a la tarea confirmada en tu cuaderno agrícola en tres pasos.',
      layout: 'timeline',
      items: [
        {
          step: '01',
          title: 'Envía instrucciones por voz o texto',
          description: 'Capataz, técnico o tractorista envían audios desde el cultivo, incluso sin cobertura estable.',
        },
        {
          step: '02',
          title: 'La IA entiende tu contexto agronómico',
          description: 'El agente identifica cultivo, parcela, labores y recursos; normaliza la orden según tus catálogos.',
        },
        {
          step: '03',
          title: 'Acciones y registros automáticos',
          description: 'Se actualiza inventario, se agenda la cuadrilla y se genera la trazabilidad en segundos.',
        },
      ],
      callout:
        '¿Quieres acelerar el despliegue? Nuestro equipo instala el agente en tus grupos de WhatsApp y configura las tablas maestras con datos reales.',
    },
    {
      title: 'Casos agronómicos prioritarios',
      subtitle: 'Las fincas que operan con ProcesIA Agro usan el agente para estas tareas diarias.',
      layout: 'grid',
      items: [
        {
          title: 'Gestión de riego y fertirrigación',
          description: 'Envía un audio para ajustar láminas, valvuleros y recetas de fertirriego; el agente programa y deja constancia.',
          tags: ['Programación riego', 'Recetas nutrientes', 'Alertas humectación'],
        },
        {
          title: 'Coordinación de cosecha',
          description: 'Normaliza cupos, cuadrillas y rutas de camiones; la información aterriza en inventario y logística al instante.',
          tags: ['Cuadrillas', 'Logística campo', 'Trazabilidad'],
        },
        {
          title: 'Seguimiento fitosanitario',
          description: 'Ordena aplicaciones, genera parte en el cuaderno digital y avisa cuando toca reentrada segura.',
          tags: ['Cuaderno digital', 'Alertas reentrada', 'Registro fitosanitario'],
        },
      ],
    },
    {
      title: 'Integraciones agronómicas',
      subtitle: 'Conectamos el agente con tus herramientas de trazabilidad, riego e inventario.',
      layout: 'grid',
      items: [
        {
          title: 'Cuaderno digital y SIEX',
          description: 'Genera registros normalizados listos para auditoría y sincroniza con tu cuaderno oficial.',
          tags: ['SIEX', 'Cuaderno digital', 'Registros normativos'],
        },
        {
          title: 'Sistemas de riego y sensores',
          description: 'Integra controladores, sondas de humedad y estaciones meteo para cerrar el ciclo de decisiones.',
          tags: ['Riego inteligente', 'IoT campo', 'Alertas clima'],
        },
        {
          title: 'ERPs y plataformas agro',
          description: 'Sincroniza con Agroptima, Auravant, John Deere Operations Center o FieldView sin duplicar datos.',
          tags: ['ERP agro', 'Maquinaria conectada', 'Inventario'],
        },
      ],
      callout: '¿Tienes un sistema propio? Lo conectamos para que el agente escriba directamente donde tus agrónomos trabajan.',
    },
  ],
  pricing: {
    tiers: [
      {
        name: 'Turnos y cuadrillas',
        description: 'Despliegue del agente para coordinar labores, maquinaria y cuadrillas en tiempo real.',
        price: 'Instalación y operación a medida',
        users: 'Cuota recurrente según usuarios y fincas',
        includes: [
          'Integración con tus listas de parcelas y labores',
          'Entrenamiento del equipo de campo en WhatsApp y Telegram',
          'Panel de seguimiento para capataces y operaciones',
        ],
        highlight: true,
      },
      {
        name: 'Inventario y trazabilidad',
        description: 'Complementa el agente con gestión de insumos, lotes y registros SIEX sincronizados.',
        price: 'Evaluación personalizada de la instalación',
        users: 'Cuota mensual en función de módulos activos',
        includes: [
          'Automatización de entradas y salidas de insumos',
          'Actualización automática de existencias y bloqueos',
          'Reportes listos para auditoría y exportación SIEX',
        ],
      },
      {
        name: 'Tratamientos y campañas',
        description: 'Añade módulos que normalizan tratamientos fitosanitarios y alertas a cuadrillas.',
        price: 'Instalación condicionada al alcance sanitario',
        users: 'Suscripción ajustada a cultivos y campañas',
        includes: [
          'Generación automática de partes de tratamiento',
          'Control de plazos de reentrada y avisos multicanal',
          'Cuaderno digital actualizado sin hojas de cálculo',
        ],
      },
      {
        name: 'Programas combinados',
        description: 'Configura paquetes a medida sumando los módulos anteriores según tu explotación.',
        price: 'Propuesta integral tras diagnóstico',
        users: 'Cuota mensual combinada bajo contrato',
        includes: [
          'Turnos + Inventario + Tratamientos + automatizaciones personalizadas',
          'Soporte agronómico dedicado en despliegue y operación',
          'Roadmap conjunto para nuevas integraciones de campo',
        ],
      },
    ],
    offline: {
      description: 'Despliega nodos offline para registrar labores sin señal y sincronizar al volver a la base.',
      extraLabel: 'Módulo sin cobertura',
      price: 'Se cotiza tras evaluar infraestructuras',
    },
    customCopy:
      'Cada finca opera con equipos y calendarios distintos. Definimos la inversión inicial y la cuota mensual tras analizar número de usuarios, integraciones necesarias y campañas previstas.',
  },
  cta: {
    primaryLabel: 'Desplegar agente en mi finca',
    primaryHref: '/automatizaciones',
    secondaryLabel: 'Agendar sesión con un agrónomo',
    secondaryHref: '/contacto',
    finalTitle: '¿Listo para que tus audios creen registros perfectos?',
    finalSubtitle:
      'Activa el Agente que entiende tu campo, valida tus integraciones y deja que la IA mantenga al día tu cuaderno agrícola.',
  },
}

const generalTemplates: AutomationTemplate[] = [
  {
    id: 'agente-whatsapp-campo',
    name: 'Agente WhatsApp que entiende tu campo',
    description:
      'Transcribe audios multilingües y activa flujos de riego, cosecha e inventario sin pasar por la oficina.',
    icon: MessageCircle,
    accentBg: 'bg-emerald-100',
    accentIcon: 'text-emerald-700',
    href: '/automatizaciones/agente-whatsapp-campo',
    badges: ['Programa estrella', 'Modo offline'],
  },
  {
    id: 'bitacora-fitosanitaria',
    name: 'Bitácora fitosanitaria automática',
    description:
      'Dicta tratamientos y el agente genera partes SIEX, valida plazos de reentrada y ajusta inventario.',
    icon: ShieldCheck,
    accentBg: 'bg-lime-100',
    accentIcon: 'text-lime-700',
    href: '/automatizaciones/bitacora-fitosanitaria',
    badges: ['SIEX listo'],
  },
  {
    id: 'programacion-riego',
    name: 'Programación inteligente de riego',
    description:
      'Envía un audio con las láminas deseadas y sincroniza válvulas, bombas y reportes de consumo de agua.',
    icon: CloudRain,
    accentBg: 'bg-sky-100',
    accentIcon: 'text-sky-600',
    href: '/automatizaciones/programacion-riego',
    badges: ['Riego inteligente'],
  },
  {
    id: 'turnos-cuadrillas',
    name: 'Turnos y cuadrillas coordinadas',
    description:
      'Asignas labores y maquinaria por lote mediante audio; la cuadrilla recibe instrucciones normalizadas al instante.',
    icon: Users,
    accentBg: 'bg-amber-100',
    accentIcon: 'text-amber-700',
    href: '/automatizaciones/turnos-cuadrillas',
    badges: ['Multiplataforma'],
  },
  {
    id: 'inventario-insumos',
    name: 'Inventario de insumos en tiempo real',
    description:
      'Actualiza existencias tras cada aplicación y bloquea lotes cuando detecta stock crítico.',
    icon: Database,
    accentBg: 'bg-purple-100',
    accentIcon: 'text-purple-700',
    href: '/automatizaciones/inventario-insumos',
    badges: ['Alertas automáticas'],
  },
  {
    id: 'trazabilidad-siex',
    name: 'Trazabilidad SIEX sin papeles',
    description:
      'Convierte órdenes en registros oficiales y comparte evidencias con auditores en un clic.',
    icon: FileSpreadsheet,
    accentBg: 'bg-emerald-50',
    accentIcon: 'text-emerald-600',
    href: '/automatizaciones/trazabilidad-siex',
    badges: ['Cumplimiento'],
  },
  {
    id: 'alertas-meteorologicas',
    name: 'Alertas agrometeorológicas',
    description:
      'Cruza datos de estaciones meteo y satelitales para reprogramar labores cuando hay riesgo.',
    icon: Sun,
    accentBg: 'bg-orange-100',
    accentIcon: 'text-orange-600',
    href: '/automatizaciones/alertas-meteorologicas',
    badges: ['Prevención'],
  },
  {
    id: 'control-invernadero',
    name: 'Control climático de invernaderos',
    description:
      'Recoge lecturas de temperatura y humedad, ajusta ventilación y deja registro en el cuaderno digital.',
    icon: Thermometer,
    accentBg: 'bg-rose-100',
    accentIcon: 'text-rose-600',
    href: '/automatizaciones/control-invernadero',
    badges: ['Sensores IoT'],
  },
  {
    id: 'seguimiento-maquinaria',
    name: 'Seguimiento de maquinaria y mantenimientos',
    description:
      'Registra horas de tractor y recuerda mantenimientos mandando audios rápidos al agente.',
    icon: Tractor,
    accentBg: 'bg-gray-100',
    accentIcon: 'text-gray-600',
    href: '/automatizaciones/seguimiento-maquinaria',
    badges: ['Preventivo'],
  },
  {
    id: 'mapa-labores',
    name: 'Mapa dinámico de labores',
    description:
      'El agente ubica cada tarea en tus parcelas y actualiza el mapa operativo para todo el equipo.',
    icon: MapPin,
    accentBg: 'bg-blue-100',
    accentIcon: 'text-blue-600',
    href: '/automatizaciones/mapa-labores',
    badges: ['Visualización'],
  },
  {
    id: 'humedad-suelo',
    name: 'Control de humedad de suelo',
    description:
      'Integra sondas para recomendar riegos y automatizar avisos con umbrales configurables.',
    icon: Droplet,
    accentBg: 'bg-teal-100',
    accentIcon: 'text-teal-600',
    href: '/automatizaciones/humedad-suelo',
    badges: ['Sensores'],
  },
  {
    id: 'campanas-productores',
    name: 'Campañas a productores y socios',
    description:
      'Segmenta avisos y convoca asambleas vía WhatsApp o SMS con mensajes generados por la IA.',
    icon: Megaphone,
    accentBg: 'bg-yellow-50',
    accentIcon: 'text-yellow-600',
    href: '/automatizaciones/campanas-productores',
    badges: ['Comunicaciones'],
  },
]

const turnosDetail: AutomationDetail = {
  ...generalDetail,
  hero: {
    ...generalDetail.hero,
    badge: 'Turnos inteligentes',
    title: 'Turnos de trabajo por voz y WhatsApp',
    description:
      'Los capataces envían audios por WhatsApp y el agente IA registra cuadrillas, fichajes y horarios en tiempo real. Consulta aquí cada jornada y descarga los partes cuando los necesites.',
  },
  sections: [
    {
      title: 'Cómo funciona turnos IA',
      subtitle: 'Operativa diseñada para Sara Quintana y su equipo.',
      layout: 'timeline',
      items: [
        {
          step: '01',
          title: 'Audio desde campo',
          description: 'El capataz dicta por WhatsApp quién entra, en qué parcela y qué tarea realizará cada cuadrilla.',
        },
        {
          step: '02',
          title: 'Normalización automática',
          description: 'El agente IA convierte el audio en registros estructurados y los asigna al plan de turnos correspondiente.',
        },
        {
          step: '03',
          title: 'Seguimiento y descargas',
          description: 'Desde este panel ves fichajes confirmados, pendientes y descargas un CSV listo para auditoría.',
        },
      ],
      callout:
        '¿Necesitas añadir nuevas cuadrillas o parcelas? Envíanos un audio y lo sincronizamos en cuestión de minutos.',
    },
    ...(generalDetail.sections?.slice(1) ?? []),
  ],
}

const turnosPlan: PanelPlanConfig = {
  id: 'turnos-trabajo',
  name: 'Turnos de trabajo',
  summary: 'Entra por WhatsApp y los registra automáticamente para Sara Quintana.',
  resources: [
    { label: 'turnos (CSV)', variant: 'download' },
    { label: 'turnos en vivo', href: '/panel/turnos' },
  ],
  dataset: {
    type: 'turnos',
    table: 'turnos_registros',
    emailColumn: 'empresa_email',
    orderBy: { column: 'fecha', ascending: false },
  },
}

const demoDetail: AutomationDetail = {
  ...generalDetail,
  hero: {
    ...generalDetail.hero,
    badge: 'Operación piloto',
    title: 'Panel demo para cooperativa Los Olivos',
    description:
      'Seguimiento personalizado de turnos, inventario y campañas para el piloto de Los Olivos. Actualizamos cada orden enviada al agente IA y sincronizamos con tus tableros internos.',
  },
}

const demoTemplates: AutomationTemplate[] = generalTemplates

export const panelConfigs: Record<string, PanelConfig> = {
  general: {
    slug: 'general',
    label: 'Panel general',
    detail: generalDetail,
    templates: generalTemplates,
  },
  turnos: {
    slug: 'turnos',
    label: 'Panel turnos Sara Quintana',
    detail: turnosDetail,
    templates: generalTemplates,
    plans: [turnosPlan],
  },
  demo: {
    slug: 'demo',
    label: 'Panel demo Los Olivos',
    detail: demoDetail,
    templates: demoTemplates,
  },
}

const panelSlugByEmail: Record<string, string> = {
  'saraquintanadg@gmail.com': 'turnos',
  'demo@procesia.agro': 'demo',
}

export function getPanelConfig(slug?: string): PanelConfig {
  const normalized = slug ? slug.toLowerCase() : 'general'
  return panelConfigs[normalized] ?? panelConfigs.general
}

export function getPanelSlugForUser(user: User | null): string {
  if (!user) return 'general'

  const metadataSlug = typeof user.user_metadata?.panelSlug === 'string' ? user.user_metadata.panelSlug : undefined
  if (metadataSlug) {
    const normalized = metadataSlug.toLowerCase()
    if (panelConfigs[normalized]) return normalized
  }

  const email = user.email?.toLowerCase()
  if (email && panelSlugByEmail[email]) {
    return panelSlugByEmail[email]
  }

  return 'general'
}
