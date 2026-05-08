"""Desktop (plyer) + in-app + email notifications."""
from __future__ import annotations

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from sqlalchemy.orm import Session
from models import Notification, UserProfile


def send_desktop_notification(title: str, message: str) -> bool:
    """Send a Windows desktop notification via plyer. Returns True on success."""
    try:
        from plyer import notification
        notification.notify(
            title=title,
            message=message,
            app_name="SkillForge OS",
            timeout=10,
        )
        return True
    except Exception as e:
        print(f"[notifier] Desktop notification failed: {e}")
        return False


def create_in_app_notification(db: Session, message: str, type_: str = "info") -> Notification:
    """Insert a notification row into DB."""
    n = Notification(message=message, type=type_, read=False)
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


def _build_email_html(subject: str, body: str, display_name: str = "there") -> str:
    """Build a polished HTML email template."""
    from datetime import datetime
    sl = subject.lower()

    # Pick icon + accent color + greeting based on context
    icon = "&#9889;"
    accent = "#6366f1"
    gradient = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)"
    greeting = f"Hey {display_name}!"
    tagline = ""

    if "morning" in sl or "mission" in sl:
        icon = "&#9728;&#65039;"
        accent = "#f59e0b"
        gradient = "linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ef4444 100%)"
        greeting = f"Good morning, {display_name}!"
        tagline = "Rise and shine — your missions await"
    elif "midday" in sl or "reminder" in sl:
        icon = "&#128276;"
        accent = "#3b82f6"
        gradient = "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)"
        greeting = f"Hey {display_name}!"
        tagline = "A friendly nudge to keep you on track"
    elif "evening" in sl or "review" in sl or "summary" in sl:
        icon = "&#127769;"
        accent = "#6366f1"
        gradient = "linear-gradient(135deg, #312e81 0%, #4338ca 40%, #6366f1 100%)"
        greeting = f"Good evening, {display_name}!"
        tagline = "Here's how your day went"
    elif "weekly" in sl or "report" in sl:
        icon = "&#128202;"
        accent = "#10b981"
        gradient = "linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)"
        greeting = f"Happy Sunday, {display_name}!"
        tagline = "Your weekly progress report is ready"
    elif "streak" in sl:
        icon = "&#128293;"
        accent = "#ef4444"
        gradient = "linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f97316 100%)"
        greeting = f"Heads up, {display_name}!"
        tagline = "Your streak needs attention"
    elif "achievement" in sl:
        icon = "&#127942;"
        accent = "#eab308"
        gradient = "linear-gradient(135deg, #ca8a04 0%, #eab308 50%, #facc15 100%)"
        greeting = f"Congratulations, {display_name}!"
        tagline = "You've unlocked something special"
    elif "test" in sl:
        icon = "&#127881;"
        accent = "#6366f1"
        gradient = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)"
        greeting = f"Welcome, {display_name}!"
        tagline = "Your email notifications are all set up"

    now = datetime.now()
    date_str = now.strftime("%B %d, %Y &middot; %I:%M %p")

    return f"""\
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f0f0f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f0f5; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width: 540px; width: 100%;">

          <!-- Logo Bar -->
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <span style="font-size: 14px; font-weight: 800; color: #6366f1; letter-spacing: 1.5px; text-transform: uppercase;">&#9889; SkillForge OS</span>
            </td>
          </tr>

          <!-- Hero Header -->
          <tr>
            <td style="background: {gradient}; padding: 40px 36px 36px; border-radius: 20px 20px 0 0; text-align: center;">
              <div style="font-size: 48px; line-height: 1; margin-bottom: 16px;">{icon}</div>
              <div style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin-bottom: 6px;">{greeting}</div>
              <div style="font-size: 14px; color: rgba(255,255,255,0.85); font-weight: 400; line-height: 1.4;">{tagline}</div>
            </td>
          </tr>

          <!-- Message Card -->
          <tr>
            <td style="background: #ffffff; padding: 0 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 28px 0; border-bottom: 1px solid #f1f5f9;">
                    <div style="background: #f8fafc; border-left: 4px solid {accent}; border-radius: 0 10px 10px 0; padding: 18px 20px;">
                      <p style="margin: 0; font-size: 15px; color: #1e293b; line-height: 1.75; font-weight: 400;">{body}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="background: #ffffff; padding: 24px 36px 32px; text-align: center;">
              <a href="http://localhost:5180" style="display: inline-block; background: {gradient}; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 14px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(99,102,241,0.3);">Open SkillForge &#8594;</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f8fafc; padding: 22px 36px; border-radius: 0 0 20px 20px; border-top: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 11px; color: #94a3b8; line-height: 1.6;">
                    <span style="font-weight: 700; color: #64748b;">SkillForge OS</span><br>
                    Your personal learning companion
                  </td>
                  <td align="right" style="font-size: 11px; color: #94a3b8; vertical-align: top;">
                    <div>{date_str}</div>
                    <a href="http://localhost:5180/settings" style="color: {accent}; text-decoration: none; font-weight: 600;">Notification Settings</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Sub-footer -->
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width: 540px; width: 100%;">
          <tr>
            <td align="center" style="padding: 20px 0 0;">
              <span style="font-size: 10px; color: #cbd5e1;">Keep forging, keep growing. One mission at a time.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_email_notification(to_email: str, app_password: str, subject: str, body: str, display_name: str = "there") -> tuple[bool, str]:
    """Send an email via Gmail SMTP. Returns (success, message)."""
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"SkillForge OS <{to_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        html = _build_email_html(subject, body, display_name)
        msg.attach(MIMEText(body, "plain"))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(to_email, app_password)
            server.send_message(msg)
        print(f"[notifier] Email sent to {to_email}")
        return True, "Email sent successfully."
    except smtplib.SMTPAuthenticationError:
        print("[notifier] Email auth failed — bad credentials")
        return False, "Authentication failed. Check your Gmail address and App Password."
    except smtplib.SMTPException as e:
        print(f"[notifier] SMTP error: {e}")
        return False, f"SMTP error: {e}"
    except Exception as e:
        print(f"[notifier] Email notification failed: {e}")
        return False, f"Failed to send email: {e}"


def push(db: Session, title: str, message: str, type_: str = "info") -> None:
    """Shortcut: desktop + in-app + email."""
    send_desktop_notification(title, message)
    create_in_app_notification(db, message, type_)

    # Email if enabled
    try:
        profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
        if (
            profile
            and profile.email_notifications_enabled
            and profile.email_address
            and profile.email_app_password
        ):
            ok, msg = send_email_notification(
                profile.email_address,
                profile.email_app_password,
                f"SkillForge — {title}",
                message,
                display_name=profile.display_name or "there",
            )
            if not ok:
                print(f"[notifier] Email skipped: {msg}")
    except Exception as e:
        print(f"[notifier] Email check failed: {e}")
