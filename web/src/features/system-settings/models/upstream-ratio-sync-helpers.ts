/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { RatioType } from '../types'
import type { PricingSyncValues } from '../types'
import { createContext, useContext } from 'react'
import { BILLING_PRICING_VARS, splitBillingExprAndRequestRules } from '@/features/pricing/lib/billing-expr'
import { tryParseVisualConfig } from '@/features/pricing/lib/tier-expr'
import {
  MODELS_DEV_PRESET_ID,
  MODELS_DEV_PRESET_NAME,
  OFFICIAL_CHANNEL_ID,
  OFFICIAL_CHANNEL_NAME,
  RATIO_TYPE_OPTIONS,
} from './constants'
import { formatPricingNumber } from './pricing-format'

export type PricingSourceSelection = { model: string; source: string }
export type PricingSourceSelections = Record<string, string>

export type RatioDifferenceEntry = {
  current: number | string | null
  upstreams: Record<string, number | string | 'same'>
  confidence: Record<string, boolean>
}

export type ModelRow = {
  key: string
  model: string
  ratioTypes: Partial<Record<RatioType, RatioDifferenceEntry>>
  billingConflict: boolean
}

export type ResolutionsMap = Record<string, Record<string, number | string>>

export type ResolutionSelection = {
  model: string
  ratioType: RatioType
  value: number | string
  sourceName: string
}

export type ResolvedResolutionSelection = ResolutionSelection & {
  ratioType: RatioType
}

export type ResolutionRemoval = {
  model: string
  ratioType: RatioType
}

export type ResolutionRemovalPlan = Map<string, Set<RatioType>>

export const RATIO_SYNC_FIELDS: RatioType[] = [
  'model_ratio',
  'completion_ratio',
  'cache_ratio',
  'create_cache_ratio',
  'image_ratio',
  'audio_ratio',
  'audio_completion_ratio',
]

export const SYNC_FIELD_ORDER: RatioType[] = [
  ...RATIO_SYNC_FIELDS,
  'model_price',
  'billing_mode',
  'billing_expr',
]

export const NUMERIC_SYNC_FIELDS = new Set<string>([
  ...RATIO_SYNC_FIELDS,
  'model_price',
])

export function getSyncFieldLabel(
  ratioType: string,
  t: (key: string) => string
): string {
  const opt = RATIO_TYPE_OPTIONS.find((o) => o.value === ratioType)
  if (opt) return t(opt.label)
  return ratioType
}

export function getOrderedRatioTypes(
  ratioTypes: Partial<Record<RatioType, RatioDifferenceEntry>>,
  filter?: string
): RatioType[] {
  const keys = Object.keys(ratioTypes) as RatioType[]
  const ordered = [
    ...SYNC_FIELD_ORDER.filter((f) => keys.includes(f)),
    ...keys.filter((f) => !SYNC_FIELD_ORDER.includes(f)),
  ]
  if (!filter || filter === '__all__') return ordered
  return ordered.filter((f) => f === filter)
}

export function getPreferredSyncField(
  ratioTypes: Partial<Record<RatioType, RatioDifferenceEntry>>,
  ratioType: RatioType,
  sourceName: string
): RatioType {
  const exprValue = ratioTypes.billing_expr?.upstreams?.[sourceName]
  if (
    ratioType !== 'billing_expr' &&
    exprValue !== null &&
    exprValue !== undefined &&
    exprValue !== 'same'
  ) {
    return 'billing_expr'
  }
  return ratioType
}

export function getVisibleRatioTypesForSource(
  ratioTypes: Partial<Record<RatioType, RatioDifferenceEntry>>,
  sourceName: string,
  filter?: string
): RatioType[] {
  return getOrderedRatioTypes(ratioTypes, filter).filter(
    (ratioType) =>
      getPreferredSyncField(ratioTypes, ratioType, sourceName) === ratioType
  )
}

export function getAlignedRatioTypes(
  ratioTypes: Partial<Record<RatioType, RatioDifferenceEntry>>,
  sourceNames: string[],
  filter?: string
): RatioType[] {
  const ordered = getOrderedRatioTypes(ratioTypes, filter)
  if (sourceNames.length === 0) return ordered

  const visible = new Set<RatioType>()
  sourceNames.forEach((sourceName) => {
    getVisibleRatioTypesForSource(ratioTypes, sourceName, filter).forEach(
      (ratioType) => visible.add(ratioType)
    )
  })

  return ordered.filter((ratioType) => visible.has(ratioType))
}

export function getBillingCategory(
  ratioType: string
): 'price' | 'ratio' | 'tiered' {
  if (ratioType === 'model_price') return 'price'
  if (ratioType === 'billing_mode' || ratioType === 'billing_expr') {
    return 'tiered'
  }
  return 'ratio'
}

export function isSelectableUpstreamValue(
  value: number | string | 'same' | null | undefined
): boolean {
  return value !== null && value !== undefined && value !== 'same'
}

export function getUpstreamDisplayName(
  sourceName: string,
  t?: (key: string) => string
): string {
  if (t) {
    if (
      sourceName === OFFICIAL_CHANNEL_NAME ||
      sourceName === `${OFFICIAL_CHANNEL_NAME}(${OFFICIAL_CHANNEL_ID})`
    ) {
      return t('Official pricing preset')
    }
    if (
      sourceName === MODELS_DEV_PRESET_NAME ||
      sourceName === `${MODELS_DEV_PRESET_NAME}(${MODELS_DEV_PRESET_ID})`
    ) {
      return t('models.dev pricing preset')
    }
  }
  const synthesizedPresets = [
    { name: OFFICIAL_CHANNEL_NAME, id: OFFICIAL_CHANNEL_ID },
    { name: MODELS_DEV_PRESET_NAME, id: MODELS_DEV_PRESET_ID },
  ]

  for (const preset of synthesizedPresets) {
    if (sourceName === `${preset.name}(${preset.id})`) {
      return preset.name
    }
  }

  return sourceName
}

export function getSyncPriceKind(
  values?: PricingSyncValues
): 'expression' | 'request' | 'token' | 'unset' {
  if (
    values?.billing_mode === 'tiered_expr' &&
    typeof values.billing_expr === 'string' &&
    values.billing_expr.trim()
  ) return 'expression'
  if (typeof values?.model_price === 'number') return 'request'
  if (typeof values?.model_ratio === 'number') return 'token'
  return 'unset'
}

export function sameSyncPrice(left: PricingSyncValues, right: PricingSyncValues): boolean {
  const fields = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const field of fields) {
    const a = left[field as keyof PricingSyncValues]
    const b = right[field as keyof PricingSyncValues]
    if (typeof a === 'number' && typeof b === 'number') {
      if (Math.abs(a - b) >= 1e-9) return false
    } else if (a !== b) return false
  }
  return true
}

export function getSyncPriceLines(values: PricingSyncValues, t: (key: string) => string) {
  if (getSyncPriceKind(values) === 'request') {
    return [{ label: t('Per-request'), value: `$${formatPricingNumber(values.model_price)}` }]
  }
  if (getSyncPriceKind(values) !== 'token') return []
  const input = Number(values.model_ratio) * 2
  const lines = [{ label: t('Input'), value: `$${formatPricingNumber(input)}` }]
  const multipliers = [
    ['completion_ratio', t('Output')],
    ['cache_ratio', t('Cache Read')],
    ['create_cache_ratio', t('Cache write')],
    ['image_ratio', t('Image input')],
    ['audio_ratio', t('Audio input')],
    ['audio_completion_ratio', t('Audio output')],
  ] as const
  for (const [field, label] of multipliers) {
    const ratio = values[field]
    if (typeof ratio !== 'number') continue
    let price = input * ratio
    if (field === 'audio_completion_ratio') {
      if (typeof values.audio_ratio !== 'number') {
        lines.push({ label, value: '—' })
        continue
      }
      price *= values.audio_ratio
    }
    lines.push({ label, value: `$${formatPricingNumber(price)}` })
  }
  return lines
}

export function getSyncExpressionPricing(expression: string, t: (key: string) => string) {
  const { billingExpr, requestRuleExpr } = splitBillingExprAndRequestRules(expression)
  const config = tryParseVisualConfig(billingExpr)
  if (!config) return null
  const body = billingExpr.replace(/"(?:\\.|[^"\\])*"/g, '')
  for (const match of body.matchAll(/\*\s*([+\-\d.eE]+)/g)) {
    if (!Number.isFinite(Number(match[1])) || Number(match[1]) < 0) return null
  }
  const fields = BILLING_PRICING_VARS.filter((field) =>
    field.tierField && new RegExp(`\\b${field.key}\\s*\\*`).test(body)
  )
  const conditionLabels = { p: t('Input tokens'), c: t('Output tokens'), len: t('Length') }
  return {
    requestRuleExpr,
    tiers: config.tiers.map((tier) => ({
      label: tier.label,
      condition: tier.conditions.map((condition) =>
        `${conditionLabels[condition.var]} ${condition.op} ${Number(condition.value).toLocaleString()}`
      ).join(' ∧ '),
      lines: fields.map((field) => ({
        label: t(field.shortLabel),
        value: `$${formatPricingNumber(Number(tier[field.tierField!]))}`,
      })),
    })),
  }
}

export function describeSyncPrice(values: PricingSyncValues, t: (key: string) => string): string {
  const kind = getSyncPriceKind(values)
  if (kind === 'expression') {
    const parsed = getSyncExpressionPricing(String(values.billing_expr), t)
    if (parsed) return [t('Expression pricing'), 'USD / ' + t('1M token'), ...parsed.tiers.flatMap((tier) => tier.lines.map((line) => `${line.label}: ${line.value}`))].join('\n')
    return `${t('Expression pricing')}\n${values.billing_expr}`
  }
  if (kind === 'unset') return t('Unset price')
  const unit = kind === 'request' ? `USD / ${t('request')}` : `USD / ${t('1M token')}`
  return [unit, ...getSyncPriceLines(values, t).map((line) => `${line.label}: ${line.value}`)].join('\n')
}

export type SyncPriceSelectionContext = {
  bulkStates: Record<string, { selections: PricingSourceSelection[]; selectedModels: string[] }>
  selectedSources: PricingSourceSelections
  isDisabled: boolean
  onSelectPrices: (selections: PricingSourceSelection[]) => void
  onUnselectPrices: (models: string[]) => void
}
export const SyncPriceContext = createContext<SyncPriceSelectionContext | null>(null)
export function useSyncPriceSelection() {
  const context = useContext(SyncPriceContext)
  if (!context) throw new Error('Sync price selection provider is required')
  return context
}

export function isSelectedResolutionValue(
  resolutions: ResolutionsMap,
  model: string,
  ratioType: RatioType,
  upstreamValue: number | string | 'same' | null | undefined
): boolean {
  if (!isSelectableUpstreamValue(upstreamValue)) return false

  const selectedValue = resolutions[model]?.[ratioType]
  if (selectedValue === undefined) return false

  if (NUMERIC_SYNC_FIELDS.has(ratioType)) {
    const selectedNumber = Number(selectedValue)
    const upstreamNumber = Number(upstreamValue)
    return (
      Number.isFinite(selectedNumber) &&
      Number.isFinite(upstreamNumber) &&
      selectedNumber === upstreamNumber
    )
  }

  return selectedValue === upstreamValue
}

export function deleteResolutionField(
  resolutions: ResolutionsMap,
  model: string,
  ratioType: RatioType
): ResolutionsMap {
  return applyResolutionRemovals(resolutions, [{ model, ratioType }])
}

function getDraftModelResolution(
  drafts: Map<string, Record<string, number | string>>,
  resolutions: ResolutionsMap,
  model: string
): Record<string, number | string> {
  const existingDraft = drafts.get(model)
  if (existingDraft) return existingDraft

  const draft = resolutions[model] ? { ...resolutions[model] } : {}
  drafts.set(model, draft)
  return draft
}

function applyResolutionSelectionToDraft(
  drafts: Map<string, Record<string, number | string>>,
  resolutions: ResolutionsMap,
  differences: Record<string, Partial<Record<RatioType, RatioDifferenceEntry>>>,
  selection: ResolutionSelection
) {
  const modelDiffs = differences[selection.model]
  const preferredType = getPreferredSyncField(
    modelDiffs || {},
    selection.ratioType,
    selection.sourceName
  )
  const preferredValue =
    preferredType === selection.ratioType
      ? selection.value
      : (modelDiffs?.[preferredType]?.upstreams?.[selection.sourceName] ??
        selection.value)

  const finalType = preferredType
  const finalValue = preferredValue as number | string
  const category = getBillingCategory(finalType)
  const newModelRes = getDraftModelResolution(
    drafts,
    resolutions,
    selection.model
  )

  Object.keys(newModelRes).forEach((rt) => {
    if (
      category !== 'tiered' &&
      getBillingCategory(rt) !== 'tiered' &&
      getBillingCategory(rt) !== category
    ) {
      delete newModelRes[rt]
    }
  })

  newModelRes[finalType] = finalValue

  if (category === 'tiered' && modelDiffs) {
    const modeVal = modelDiffs.billing_mode?.upstreams?.[selection.sourceName]
    const exprVal = modelDiffs.billing_expr?.upstreams?.[selection.sourceName]
    if (modeVal !== undefined && modeVal !== null && modeVal !== 'same') {
      newModelRes['billing_mode'] = modeVal
    } else if (finalType === 'billing_expr') {
      newModelRes['billing_mode'] = 'tiered_expr'
    }
    if (exprVal !== undefined && exprVal !== null && exprVal !== 'same') {
      newModelRes['billing_expr'] = exprVal
    }
  }
}

export function resolveResolutionSelection(
  differences: Record<string, Partial<Record<RatioType, RatioDifferenceEntry>>>,
  selection: ResolutionSelection
): ResolvedResolutionSelection {
  const modelDiffs = differences[selection.model]
  const preferredType = getPreferredSyncField(
    modelDiffs || {},
    selection.ratioType,
    selection.sourceName
  )
  const preferredValue =
    preferredType === selection.ratioType
      ? selection.value
      : (modelDiffs?.[preferredType]?.upstreams?.[selection.sourceName] ??
        selection.value)

  return {
    ...selection,
    ratioType: preferredType,
    value: preferredValue as number | string,
  }
}

export function getEffectiveResolutionSelections(
  differences: Record<string, Partial<Record<RatioType, RatioDifferenceEntry>>>,
  selections: ResolutionSelection[]
): ResolvedResolutionSelection[] {
  const effectiveByKey = new Map<string, ResolvedResolutionSelection>()

  selections.forEach((selection) => {
    const resolved = resolveResolutionSelection(differences, selection)
    const category = getBillingCategory(resolved.ratioType)

    if (category !== 'tiered') {
      for (const [key, existing] of effectiveByKey) {
        if (
          existing.model === resolved.model &&
          getBillingCategory(existing.ratioType) !== 'tiered' &&
          getBillingCategory(existing.ratioType) !== category
        ) {
          effectiveByKey.delete(key)
        }
      }
    }

    effectiveByKey.set(`${resolved.model}\u0000${resolved.ratioType}`, resolved)
  })

  return [...effectiveByKey.values()]
}

export function applyResolutionSelections(
  resolutions: ResolutionsMap,
  differences: Record<string, Partial<Record<RatioType, RatioDifferenceEntry>>>,
  selections: ResolutionSelection[]
): ResolutionsMap {
  if (selections.length === 0) return resolutions

  const next = { ...resolutions }
  const drafts = new Map<string, Record<string, number | string>>()

  selections.forEach((selection) => {
    applyResolutionSelectionToDraft(drafts, resolutions, differences, selection)
  })

  drafts.forEach((draft, model) => {
    if (Object.keys(draft).length === 0) {
      delete next[model]
    } else {
      next[model] = draft
    }
  })

  return next
}

export function applyResolutionSelection(
  resolutions: ResolutionsMap,
  differences: Record<string, Partial<Record<RatioType, RatioDifferenceEntry>>>,
  selection: ResolutionSelection
): ResolutionsMap {
  return applyResolutionSelections(resolutions, differences, [selection])
}

export function applyResolutionRemovals(
  resolutions: ResolutionsMap,
  removals: ResolutionRemoval[]
): ResolutionsMap {
  if (removals.length === 0) return resolutions

  const plan: ResolutionRemovalPlan = new Map()
  removals.forEach((removal) => {
    const ratioTypes = plan.get(removal.model)
    if (ratioTypes) {
      ratioTypes.add(removal.ratioType)
    } else {
      plan.set(removal.model, new Set([removal.ratioType]))
    }
  })

  return applyResolutionRemovalPlan(resolutions, plan)
}

export function applyResolutionRemovalPlan(
  resolutions: ResolutionsMap,
  plan: ResolutionRemovalPlan
): ResolutionsMap {
  if (plan.size === 0) return resolutions

  const next = { ...resolutions }

  plan.forEach((ratioTypes, model) => {
    const current = resolutions[model]
    if (!current) return

    const draft = { ...current }
    ratioTypes.forEach((ratioType) => {
      delete draft[ratioType]
      if (ratioType === 'billing_expr') delete draft['billing_mode']
      if (ratioType === 'billing_mode') delete draft['billing_expr']
    })
    if (Object.keys(draft).length === 0) {
      delete next[model]
    } else {
      next[model] = draft
    }
  })

  return next
}
