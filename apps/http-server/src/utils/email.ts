import nodemailer from 'nodemailer'
import { errorResponse } from './error';


const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS


const transporter = nodemailer.createTransport({
    service: 'Gmail',
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
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
        await transporter.sendMail({

            from: `"Qtrive" <${user}>`,
            to,
            subject: `You have been invited to co-organize: ${quizTitle}`,
            html: `<h2>You are invited!</h2>
                 <p>You have been invited to co-organize the quiz <strong>${quizTitle}</strong>.</p>
                 <p>Click the link below to accept the invitation:</p>
                 <a href="${inviteUrl}">${inviteUrl}</a>`
        });
    } catch (error) {

        console.log('Error while sending email', error);
    }
}