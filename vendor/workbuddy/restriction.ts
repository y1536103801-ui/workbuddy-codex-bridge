/** Shared display contract for the plugin, MCP and local workbench. No routing decisions. */
export interface AccountRestriction {
  source: 'upstream' | 'local'
  title: string
  reason: string
  recoveryAt?: number
  recoveryLabel: string
  recoveryBasis: 'upstream' | 'local_estimate' | 'window' | 'unknown'
  observedAt?: number
  code?: string
  action: string
}
export function upstreamReason(message: string): { reason: string; code?: string } {
  let reason = message, code: string | undefined
  try {
    const data = JSON.parse(message) as Record<string, unknown>
    const value = data['msg'] ?? data['message']
    reason = typeof value === 'string' ? value : '上游拒绝请求，未提供可读原因'
    if (typeof data['code'] === 'number' || typeof data['code'] === 'string') code = String(data['code']).slice(0, 40)
  } catch { if (message.trim().startsWith('{')) reason = '上游拒绝请求，原始回执不完整' }
  reason = reason.replace(/Bearer\s+\S+/giu, 'Bearer [隐藏]').replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/gu, '[隐藏凭据]').slice(0, 300)
  return { reason, ...(code ? { code } : {}) }
}
export function chinaTime(at: number): string {
  return new Date(at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) + '（北京时间）'
}
export function restrictionMessage(value: AccountRestriction): string {
  return `${value.title}${value.code ? `（上游代码 ${value.code}）` : ''}：${value.reason}。${value.recoveryLabel}${value.recoveryAt ? '：' + chinaTime(value.recoveryAt) : ''}。${value.action}`
}
