export type SupportFieldKey =
  | 'cliente'
  | 'instancia'
  | 'link_retaguarda'
  | 'link_sessao'
  | 'observacao'

export interface FieldConfig {
  visible: boolean
  label?: string
  required?: boolean
}

export interface DepartmentTerminology {
  ticket_singular: string
  ticket_plural: string
}

export interface DepartmentModules {
  announcements: boolean
  links: boolean
}

export interface DepartmentSettings {
  terminology: DepartmentTerminology
  fields: Record<SupportFieldKey, FieldConfig>
  modules: DepartmentModules
}

export const DEFAULT_DEPARTMENT_SETTINGS: DepartmentSettings = {
  terminology: {
    ticket_singular: 'Chamado',
    ticket_plural: 'Chamados',
  },
  fields: {
    cliente: { visible: true, label: 'Cliente', required: false },
    instancia: { visible: true, label: 'Instância', required: false },
    link_retaguarda: { visible: true, label: 'Link Retaguarda' },
    link_sessao: { visible: true, label: 'Link Sessão' },
    observacao: { visible: true, label: 'Observações' },
  },
  modules: {
    announcements: true,
    links: true,
  },
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function mergeDepartmentSettings(
  partial: unknown
): DepartmentSettings {
  const base = DEFAULT_DEPARTMENT_SETTINGS
  if (!isObject(partial)) return base

  const terminology = isObject(partial.terminology) ? partial.terminology : {}
  const fields = isObject(partial.fields) ? partial.fields : {}
  const modules = isObject(partial.modules) ? partial.modules : {}

  const mergedFields = { ...base.fields }
  for (const key of Object.keys(base.fields) as SupportFieldKey[]) {
    const override = fields[key]
    if (isObject(override)) {
      mergedFields[key] = {
        ...base.fields[key],
        ...(typeof override.visible === 'boolean' ? { visible: override.visible } : {}),
        ...(typeof override.label === 'string' ? { label: override.label } : {}),
        ...(typeof override.required === 'boolean' ? { required: override.required } : {}),
      }
    }
  }

  return {
    terminology: {
      ticket_singular:
        typeof terminology.ticket_singular === 'string'
          ? terminology.ticket_singular
          : base.terminology.ticket_singular,
      ticket_plural:
        typeof terminology.ticket_plural === 'string'
          ? terminology.ticket_plural
          : base.terminology.ticket_plural,
    },
    fields: mergedFields,
    modules: {
      announcements:
        typeof modules.announcements === 'boolean'
          ? modules.announcements
          : base.modules.announcements,
      links:
        typeof modules.links === 'boolean' ? modules.links : base.modules.links,
    },
  }
}
