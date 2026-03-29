import { describe, expect, it } from "vitest";

import { accountWarningEmail } from "@/lib/email/templates/account-warning";
import { contactForwardedEmail } from "@/lib/email/templates/contact-forwarded";
import { contactRequestEmail } from "@/lib/email/templates/contact-request";
import { contactRespondedEmail } from "@/lib/email/templates/contact-responded";
import { proApplicationEmail } from "@/lib/email/templates/pro-application";
import { proApprovedEmail } from "@/lib/email/templates/pro-approved";
import { proRejectedEmail } from "@/lib/email/templates/pro-rejected";
import { reactionNotificationEmail } from "@/lib/email/templates/reaction-notification";
import { replyNotificationEmail } from "@/lib/email/templates/reply-notification";
import { reportResolvedEmail } from "@/lib/email/templates/report-resolved";
import { reportSubmittedEmail } from "@/lib/email/templates/report-submitted";
import { welcomeEmail } from "@/lib/email/templates/welcome";
import { withdrawalEmail } from "@/lib/email/templates/withdrawal";

describe("Email templates", () => {
  it("returns subject and html for every template", () => {
    const templates = [
      proApplicationEmail({
        nickname: "テスト",
        email: "test@test.com",
        specialtyName: "事業再生",
        applicationText: "テスト内容",
        applicationId: "uuid",
        appliedAt: "2026-03-29",
      }),
      replyNotificationEmail({
        recipientNickname: "テスト",
        notificationKind: "reply_to_consultation",
        consultationTitle: "テスト相談",
        consultationId: "uuid",
        replyCount: 1,
      }),
      replyNotificationEmail({
        recipientNickname: "テスト",
        notificationKind: "reply_to_answer",
        consultationTitle: "テスト相談",
        consultationId: "uuid",
        replyCount: 2,
      }),
      contactRequestEmail({
        requesterNickname: "テスト",
        requesterEmail: "test@test.com",
        targetNickname: "プロ",
        targetSpecialtyName: "弁護士",
        subject: "件名",
        message: "本文",
        requestId: "uuid",
      }),
      reportSubmittedEmail({
        reporterNickname: "通報者",
        targetType: "consultation",
        targetTitle: "タイトル",
        reason: "spam",
        detail: null,
        reportId: "rid",
      }),
      reportResolvedEmail({ nickname: "テスト" }),
      accountWarningEmail({ nickname: "テスト", reason: "理由" }),
      proApprovedEmail({ nickname: "テスト", specialtyName: "事業再生" }),
      proRejectedEmail({ nickname: "テスト" }),
      contactForwardedEmail({
        proNickname: "プロ",
        requesterNickname: "依頼者",
        subject: "件名",
        message: "本文",
      }),
      contactRespondedEmail({
        requesterNickname: "依頼者",
        proNickname: "プロ",
      }),
      reactionNotificationEmail({
        recipientNickname: "テスト",
        consultationTitle: "相談タイトル",
        consultationId: "cid",
        reactionCount: 1,
      }),
      welcomeEmail({ nickname: "テスト", role: "consulter" }),
      withdrawalEmail({ nickname: "テスト" }),
    ];

    for (const t of templates) {
      expect(t.subject).toBeTruthy();
      expect(t.subject).toContain("もりみち");
      expect(t.html).toBeTruthy();
      expect(t.html).not.toContain("undefined");
      expect(t.html).not.toContain("null");
    }
  });

  it("escapes XSS payloads in pro application", () => {
    const result = proApplicationEmail({
      nickname: '<script>alert("xss")</script>',
      email: "test@test.com",
      specialtyName: "事業再生",
      applicationText: '<img onerror="alert(1)" src=x>',
      applicationId: "uuid",
      appliedAt: "2026-03-29",
    });
    expect(result.html).not.toMatch(/<script/i);
    expect(result.html).not.toMatch(/<img[^>]*\sonerror=/i);
  });

  it("includes admin deep links for operator emails", () => {
    const app = proApplicationEmail({
      nickname: "テスト",
      email: "test@test.com",
      specialtyName: "事業再生",
      applicationText: "内容",
      applicationId: "test-id",
      appliedAt: "2026-03-29",
    });
    expect(app.html).toContain("https://morimichi.cc/admin/pro/applications/test-id");

    const req = contactRequestEmail({
      requesterNickname: "テスト",
      requesterEmail: "test@test.com",
      targetNickname: "プロ",
      targetSpecialtyName: "弁護士",
      subject: "件名",
      message: "本文",
      requestId: "req-id",
    });
    expect(req.html).toContain("https://morimichi.cc/admin/contact-requests/req-id");

    const rep = reportSubmittedEmail({
      reporterNickname: "r",
      targetType: "reply",
      targetTitle: "t",
      reason: "other",
      detail: null,
      reportId: "rep-id",
    });
    expect(rep.html).toContain("https://morimichi.cc/admin/reports/rep-id");
  });
});
