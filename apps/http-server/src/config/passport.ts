
import { prisma } from '@repo/db';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    callbackURL: "/auth/google/callback"
},
    async (accessToken, refreshToken, profile, cb) => {
        try {
            let user = await prisma.user.update(where: { googleId: profile.id }, data: { isLoggedIn: true })

        } catch (error) {

        }
    }
));