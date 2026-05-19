import { useEffect, useRef, useState } from 'react'
import { Button, Card, Form, Input, Typography } from 'antd'

import { CosmicBackdrop } from './CosmicBackdrop'
import { appMessage } from '../lib/antdApp'
import { requestJson } from '../lib/api'
import type { RegisterConfig } from '../types/chat'

type RegistrationScreenProps = {
  onRegistered: () => void | Promise<void>
  onBackToLogin: () => void
}

declare global {
  interface Window {
    initGeetest4?: (config: { captchaId: string; product: string }, callback: (captcha: GeetestCaptcha) => void) => void
  }
}

type GeetestCaptcha = {
  appendTo: (selector: string) => void
  getValidate: () => {
    lot_number: string
    captcha_output: string
    pass_token: string
    gen_time: string
  } | false
  reset: () => void
  showBox: () => void
}

export function RegistrationScreen({ onRegistered, onBackToLogin }: RegistrationScreenProps) {
  const [form] = Form.useForm()
  const [config, setConfig] = useState<RegisterConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [codeCountdown, setCodeCountdown] = useState(0)
  const captchaRef = useRef<GeetestCaptcha | null>(null)
  const geetestReadyRef = useRef(false)
  const geetestContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const data = await requestJson<{ ok: boolean } & RegisterConfig>('/api/auth/register/config')
        if (!active) return
        setConfig({
          registration_enabled: Boolean(data.registration_enabled),
          email_verification_enabled: Boolean(data.email_verification_enabled),
          geetest_enabled: Boolean(data.geetest_enabled),
          geetest_captcha_id: String(data.geetest_captcha_id ?? ''),
        })
      } catch {
        if (!active) return
        setConfig({ registration_enabled: false, email_verification_enabled: false, geetest_enabled: false, geetest_captcha_id: '' })
      }
    }
    void load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!config?.geetest_enabled || !config.geetest_captcha_id) return
    if (geetestReadyRef.current) return

    let mounted = true
    const captchaId = config.geetest_captcha_id

    function initCaptcha() {
      if (!mounted || !window.initGeetest4 || geetestReadyRef.current) return
      window.initGeetest4({ captchaId, product: 'popup' }, (captcha) => {
        if (!mounted) return
        captchaRef.current = captcha
        geetestReadyRef.current = true
        captcha.appendTo('#geetest-register-container')
      })
    }

    if (window.initGeetest4) {
      initCaptcha()
      return () => { mounted = false }
    }

    const existing = document.querySelector('script[src*="geetest"]')
    if (existing) {
      existing.addEventListener('load', initCaptcha)
      return () => {
        mounted = false
        existing.removeEventListener('load', initCaptcha)
      }
    }

    const script = document.createElement('script')
    script.src = 'https://static.geetest.com/v4/gt4.js'
    script.onload = initCaptcha
    document.head.appendChild(script)

    return () => { mounted = false }
  }, [config?.geetest_enabled, config?.geetest_captcha_id])

  useEffect(() => {
    if (codeCountdown <= 0) return
    const timer = setTimeout(() => setCodeCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [codeCountdown])

  async function handleSendCode() {
    const email = form.getFieldValue('email') as string
    if (!email || !email.includes('@')) {
      appMessage.warning('请先输入有效的邮箱地址')
      return
    }
    setSendingCode(true)
    try {
      await requestJson<{ ok: boolean }>('/api/auth/register/send-code', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      appMessage.success('验证码已发送')
      setCodeCountdown(60)
    } catch (error) {
      appMessage.error(error instanceof Error ? error.message : '发送验证码失败')
    } finally {
      setSendingCode(false)
    }
  }

  async function handleSubmit() {
    try {
      const values = await form.validateFields()
      if (values.password !== values.confirmPassword) {
        appMessage.error('两次输入的密码不一致')
        return
      }

      setLoading(true)

      let geetestParams: Record<string, string> | undefined
      if (config?.geetest_enabled && captchaRef.current) {
        const result = captchaRef.current.getValidate()
        if (!result) {
          appMessage.warning('请先完成人机验证')
          setLoading(false)
          return
        }
        geetestParams = result as unknown as Record<string, string>
      }

      await requestJson<{ ok: boolean; user?: unknown }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          code: values.code || '',
          geetest_params: geetestParams,
        }),
      })

      appMessage.success('注册成功，请登录')
      onRegistered()
    } catch (error) {
      appMessage.error(error instanceof Error ? error.message : '注册失败')
      if (captchaRef.current) {
        captchaRef.current.reset()
      }
    } finally {
      setLoading(false)
    }
  }

  if (config === null) {
    return (
      <div className="login-screen">
        <CosmicBackdrop />
      </div>
    )
  }

  if (!config.registration_enabled) {
    return (
      <div className="login-screen">
        <CosmicBackdrop />
        <div className="login-glow login-glow-left" aria-hidden="true" />
        <div className="login-glow login-glow-right" aria-hidden="true" />
        <Card className="login-card">
          <div className="login-copy">
            <Typography.Title level={2} className="login-title">
              注册未开放
            </Typography.Title>
            <Typography.Paragraph className="login-desc" style={{ textAlign: 'center' }}>
              当前系统未开放外部注册，请联系管理员开通。
            </Typography.Paragraph>
          </div>
          <Button block onClick={onBackToLogin}>
            返回登录
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="login-screen">
      <CosmicBackdrop />
      <div className="login-glow login-glow-left" aria-hidden="true" />
      <div className="login-glow login-glow-right" aria-hidden="true" />
      <Card className="login-card">
        <div className="login-copy">
          <Typography.Title level={2} className="login-title">
            ChatAPI 注册
          </Typography.Title>
        </div>
        <Form
          form={form}
          layout="vertical"
          onFinish={() => void handleSubmit()}
          autoComplete="off"
          className="login-form"
          initialValues={{ email: '', password: '', confirmPassword: '', code: '' }}
        >
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="邮箱地址" size="large" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="密码（至少 4 个字符）" size="large" />
          </Form.Item>
          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入密码" size="large" />
          </Form.Item>
          {config.email_verification_enabled ? (
            <Form.Item
              label="验证码"
              name="code"
              rules={[{ required: true, message: '请输入邮箱验证码' }]}
            >
              <Input
                placeholder="6 位邮箱验证码"
                size="large"
                inputMode="numeric"
                maxLength={6}
                addonAfter={
                  <Button
                    type="link"
                    size="small"
                    disabled={codeCountdown > 0 || sendingCode}
                    loading={sendingCode}
                    onClick={() => void handleSendCode()}
                    style={{ padding: 0, margin: 0 }}
                  >
                    {codeCountdown > 0 ? `${codeCountdown}s` : '发送验证码'}
                  </Button>
                }
              />
            </Form.Item>
          ) : null}
          {config.geetest_enabled ? (
            <Form.Item label="人机验证">
              <div ref={geetestContainerRef} id="geetest-register-container" />
            </Form.Item>
          ) : null}
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            注册
          </Button>
          <Button block onClick={onBackToLogin}>
            返回登录
          </Button>
        </Form>
      </Card>
    </div>
  )
}
