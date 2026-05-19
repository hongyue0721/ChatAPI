from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from logging import Logger

from ..core import settings


def _build_smtp_connection(logger: Logger) -> tuple[smtplib.SMTP | smtplib.SMTP_SSL, str] | tuple[None, str]:
    host = settings.smtp_host
    port = settings.smtp_port
    username = settings.smtp_username
    password = settings.smtp_password
    use_tls = settings.smtp_use_tls

    if not host:
        return None, "SMTP_HOST 未配置"

    try:
        use_ssl = (port == 465)
        if use_ssl:
            server: smtplib.SMTP | smtplib.SMTP_SSL = smtplib.SMTP_SSL(host, port, timeout=10)
        else:
            server = smtplib.SMTP(host, port, timeout=10)

        if not use_ssl and use_tls:
            server.starttls()
            server.ehlo()

        if username and password:
            server.login(username, password)

        return server, ""
    except smtplib.SMTPAuthenticationError:
        return None, "SMTP 认证失败，请检查用户名和密码"
    except smtplib.SMTPConnectError:
        return None, f"无法连接到 SMTP 服务器 {host}:{port}"
    except smtplib.SMTPException as exc:
        return None, f"SMTP 错误: {exc}"
    except Exception as exc:
        logger.exception("[SMTP] connection failed")
        return None, f"连接失败: {exc}"


def _send_email(to: str, subject: str, body: str, *, logger: Logger) -> tuple[bool, str]:
    server, err = _build_smtp_connection(logger)
    if server is None:
        return False, err

    from_addr = settings.smtp_from or settings.smtp_username

    try:
        msg = MIMEMultipart()
        msg["From"] = from_addr
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))
        server.sendmail(from_addr, [to], msg.as_string())
        return True, "邮件已发送"
    except smtplib.SMTPException as exc:
        return False, f"SMTP 错误: {exc}"
    except Exception as exc:
        logger.exception("[SMTP] send failed")
        return False, f"发送失败: {exc}"
    finally:
        try:
            server.quit()
        except Exception:
            pass


def send_test_email(to: str, *, logger: Logger) -> tuple[bool, str]:
    return _send_email(to, "ChatAPI 测试邮件", "这是一封来自 ChatAPI 的测试邮件，说明 SMTP 配置正确。", logger=logger)


def send_verification_email(to: str, code: str, *, logger: Logger) -> tuple[bool, str]:
    subject = "ChatAPI 邮箱验证码"
    body = f"您的验证码是：{code}\n\n验证码 5 分钟内有效，请勿泄露给他人。"
    return _send_email(to, subject, body, logger=logger)
