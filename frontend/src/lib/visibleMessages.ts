import type { MessageItem, VisibleMessage } from '../types/chat'

export function buildVisibleMessages(messages: MessageItem[], draftBuffer: string): VisibleMessage[] {
  const visible: VisibleMessage[] = []
  const toolResultIndexByCallId = new Map<string, number>()

  for (const item of messages) {
    const isToolResult = item.metadata?.response_mode === 'tool_result'
    const toolCallId = String(item.metadata?.tool_call_id ?? '').trim()

    if (isToolResult && toolCallId) {
      const existingIndex = toolResultIndexByCallId.get(toolCallId)
      if (existingIndex != null) {
        visible[existingIndex] = item
        continue
      }
      toolResultIndexByCallId.set(toolCallId, visible.length)
    }

    visible.push(item)
  }

  if (!draftBuffer) {
    return visible
  }

  return [
    ...visible,
    {
      id: 'draft-buffer',
      role: 'draft',
      content: draftBuffer,
      created_at: new Date().toISOString(),
      draft: true,
    },
  ]
}
