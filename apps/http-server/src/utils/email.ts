import nodemailer from 'nodemailer'
import { errorResponse } from './error';


const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS


const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: user,
        pass: pass
    },
});

export const sendInviteEmail = async (to: string, quizTitle: string, inviteUrl: string) => {
    if (!user || !pass) {
        console.log(`[EMail mock] To: ${to} | Quiz: ${quizTitle} | Link: ${inviteUrl}`);
        return;
    }

    try {
        const info = await transporter.sendMail({

            from: `"Rexial" <${user}>`,
            to,
            subject: `You have been invited to co-organize: ${quizTitle}`,
            html: `<div style="font-family:sans-serif">
  <h2>You're invited to collaborate 🎉</h2>
  <p><b>${quizTitle}</b></p>
  <a href="${inviteUrl}" style="padding:10px 16px;background:#ec4899;color:white;border-radius:6px;text-decoration:none;">
    Accept Invite
  </a>
</div>`
        });
    } catch (error) {

        console.log('Error while sending email', error);
    }
}