import { App, Avatar, Button, Empty, Spin } from 'antd'
import { CopyOutlined, UserOutlined } from '@ant-design/icons'

import {
  buildCurlCommand,
  formatJson,
  formatTime,
  renderMessageContent,
} from '../lib/chat-format'
import type { VisibleMessage } from '../types/chat'

type ChatMessageListProps = {
  messagesLoading: boolean
  sending: boolean
  isWaitingForUser: boolean
  visibleMessages: VisibleMessage[]
}

export function ChatMessageList({
  isWaitingForUser,
  messagesLoading,
  sending,
  visibleMessages,
}: ChatMessageListProps) {
  const { message: antMessage } = App.useApp()

  if (messagesLoading && visibleMessages.length === 0) {
    return (
      <div className="empty-stage">
        <Spin size="large" />
      </div>
    )
  }

  if (visibleMessages.length === 0) {
    return (
      <div className="empty-stage">
        <Empty
          description={
            isWaitingForUser
              ? '可以开始流式输出，再点击结束输出完成这一轮'
              : '等待左侧会话出现绿色状态后再回复'
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    )
  }

  return (
    <>
      {visibleMessages.map((item) => {
        const isUser = item.role === 'user'
        const isToolInput = item.role === 'tool'
        const isDraft = item.role === 'draft'
        const isToolCall = item.metadata?.response_mode === 'tool_call'
        const isToolResult = item.metadata?.response_mode === 'tool_result'
        const requestDebug = item.metadata?.request_debug
        const debugSections = [
          {
            label: '请求格式',
            value: requestDebug?.request_format || item.metadata?.request_format || '',
          },
          { label: '模型', value: requestDebug?.model || item.metadata?.model || '' },
          { label: '请求 ID', value: requestDebug?.request_id || '' },
          { label: '响应 ID', value: requestDebug?.response_id || item.response_id || '' },
          { label: '请求 Keys', value: requestDebug?.request_keys?.join(', ') || '' },
          { label: 'User-Agent', value: requestDebug?.headers?.user_agent || '' },
          { label: 'Content-Type', value: requestDebug?.headers?.content_type || '' },
        ].filter((section) => section.value)
        const hasDebugCard =
          isUser &&
          !isDraft &&
          !!(
            debugSections.length ||
            requestDebug?.tool_schemas?.length ||
            requestDebug?.input_payload != null ||
            requestDebug?.request_body != null
          )

        return (
          <div
            key={item.id}
            className={`message-row ${
              isUser
                ? 'user'
                : isToolInput
                  ? 'tool-input'
                  : isToolCall
                    ? 'tool-call'
                    : isToolResult
                      ? 'tool-result'
                      : 'assistant'
            } ${isDraft ? 'draft' : ''}`}
          >
            {(isUser || isToolInput) && (
              <Avatar className="message-avatar user-avatar" icon={<UserOutlined />} />
            )}
            <div
              className={`message-bubble ${
                isUser
                  ? 'user'
                  : isToolInput
                    ? 'tool-input'
                    : isToolCall
                      ? 'tool-call'
                      : isToolResult
                        ? 'tool-result'
                        : 'assistant'
              } ${isDraft ? 'draft' : ''}`}
            >
              {isToolCall && <div className="message-kind-badge">Tool Call</div>}
              {isToolResult && <div className="message-kind-badge tool-result">Tool Result</div>}
              <div className="message-content">{renderMessageContent(item.content)}</div>
              {(isToolCall || isToolResult) && (
                <div className="message-tool-meta">
                  <div>
                    <span className="message-debug-label">Tool</span>
                    <span className="message-debug-value">{item.metadata?.tool_name || '-'}</span>
                  </div>
                  <div>
                    <span className="message-debug-label">Call ID</span>
                    <span className="message-debug-value">{item.metadata?.tool_call_id || '-'}</span>
                  </div>
                </div>
              )}
              {hasDebugCard && (
                <details className="message-debug-card">
                  <summary>请求详情</summary>
                  <div className="message-debug-body">
                    {debugSections.map((section) => (
                      <div key={section.label} className="message-debug-row">
                        <span className="message-debug-label">{section.label}</span>
                        <span className="message-debug-value">{section.value}</span>
                      </div>
                    ))}
                    {requestDebug?.tool_schemas?.length ? (
                      <div className="message-debug-block">
                        <div className="message-debug-label">Tool Schemas</div>
                        <pre>{formatJson(requestDebug.tool_schemas)}</pre>
                      </div>
                    ) : null}
                    {requestDebug?.input_payload != null ? (
                      <div className="message-debug-block">
                        <div className="message-debug-label">Input Payload</div>
                        <pre>{formatJson(requestDebug.input_payload)}</pre>
                      </div>
                    ) : null}
                    {requestDebug?.request_body != null ? (
                      <div className="message-debug-block">
                        <div className="message-debug-label-row">
                          <span className="message-debug-label">Request Body</span>
                          <Button
                            size="small"
                            type="link"
                            icon={<CopyOutlined />}
                            className="copy-curl-btn"
                            onClick={() => {
                              const curl = buildCurlCommand(requestDebug.request_body)
                              if (!curl) return
                              if (navigator.clipboard && window.isSecureContext) {
                                navigator.clipboard.writeText(curl).then(() => {
                                  antMessage.success('已复制 curl')
                                }).catch(() => {
                                  antMessage.error('复制失败')
                                })
                              } else {
                                const textarea = document.createElement('textarea')
                                textarea.value = curl
                                textarea.style.position = 'fixed'
                                textarea.style.opacity = '0'
                                document.body.appendChild(textarea)
                                textarea.select()
                                document.execCommand('copy')
                                document.body.removeChild(textarea)
                                antMessage.success('已复制 curl')
                              }
                            }}
                          >
                            复制 curl
                          </Button>
                        </div>
                        <pre>{formatJson(requestDebug.request_body)}</pre>
                      </div>
                    ) : null}
                  </div>
                </details>
              )}
              <div className="message-meta">
                <span>
                  {isDraft
                    ? '流式输出中'
                    : isToolInput
                      ? 'tool'
                      : isToolCall
                        ? 'tool_call'
                        : isToolResult
                          ? 'tool_result'
                          : item.role}
                </span>
                <span>{formatTime(item.created_at)}</span>
              </div>
            </div>
            {!isUser && !isToolInput && (
              <Avatar className="message-avatar assistant-avatar">AI</Avatar>
            )}
          </div>
        )
      })}
      {sending && (
        <div className="message-row assistant">
          <Avatar className="message-avatar assistant-avatar">AI</Avatar>
          <div className="message-bubble assistant typing">
            <Spin size="small" />
            <span>正在生成回复...</span>
          </div>
        </div>
      )}
    </>
  )
}
