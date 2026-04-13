import { prisma } from "@repo/db";
import { Response, Request } from "express"
import { errorResponse } from "../utils/error";
import { v4 as uuidv4 } from "uuid";

export const inviteCoOrganizerController = async (req: Request, res: Response) => {
    try {

        const quizId = req.params.quizId;
        const { email } = req.body;

        const quiz = await prisma.quiz.findUnique({
            where: {
                id: quizId as string
            }
        });


        if (!quiz) return errorResponse(res, 404, 'Quiz not found');

        if (quiz.creatorId !== req.userId) return errorResponse(res, 403, 'Only Owner can invite...');

        const targetUser = await prisma.user.findUnique({
            where: {
                email
            }
        });

        const inviteToken = uuidv4();

        // if the user exists already then simply it added to that user as co-organizer otherwise create a new user...
        await prisma.quizOrganizer.create({
            data: {
                quizId: quizId as string,
                userId: targetUser ? targetUser.id : null,
                inviteEmail: email,
                inviteToken: inviteToken,
                role: 'CO_ORGANIZER',
                inviteStatus: 'PENDING'
            }
        });


        const inviteUrl = `${process.env.FRONTEND_URL}/invite/accept/${inviteToken}`;

        // now define a function to send the mail to the co-organizer



        return res.status(200).json({
            message: 'Invitation Sent'
        })

    } catch (error) {
        console.log('Error while sending mail...', error);
        return errorResponse(res, 500, 'Internal Server Error');
    }
}


// logic for accepting invitation
 export const  acceptInvitationController = async(req:Request, res:Response) => {
    try {

        const token = req.params.token;

        const invite = await prisma.quizOrganizer.findUnique({
            where: {inviteToken: token as string}
        });

        if(!invite || invite.inviteStatus === 'ACCEPTED') return errorResponse(res, 400, 'Invalid or expired invitation');

        // verify logged-in user matches invited email if applicable
        const user = await prisma.user.findUnique({
            where: {
                id: invite.id
            },
        });

        if(invite.inviteEmail && invite.inviteEmail !== user?.email) return errorResponse(res, 400, 'Email is not matching. Try again later');

        await prisma.quizOrganizer.update({
            where: {id: invite.id},
            data: {
                inviteStatus: 'ACCEPTED',
                userId: req.userId,
                inviteToken: null
            }
        });

        res.status(200).json({
            message: 'Invitation accepted...'
        })
        
    } catch (error) {
        console.log("eror while accepting the invitation", error);
        return errorResponse(res, 500, 'Internal Server Error...')
    }
 }