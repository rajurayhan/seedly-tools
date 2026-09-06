import { ConvexError } from 'convex/values';
import { internalQuery } from './_generated/server';
import { resolveUserBySubject } from './_helpers';

export const resolveActionAuthWithGate = internalQuery({
  args: {},
  handler: async (ctx, args) => {
    const user = await resolveUserBySubject(ctx, args.subject);
    if (!user) throw new ConvexError('Not authenticated');
    if (!user.isActive) throw new ConvexError('Not authenticated');

    return { userId: user._id };
  },
});
