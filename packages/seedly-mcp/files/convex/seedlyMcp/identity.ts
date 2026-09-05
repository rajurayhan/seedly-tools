import { internalQuery } from '../_generated/server';
import { v } from 'convex/values';

type ApiMeUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  jobTitle?: string;
  timezone?: string;
  isActive: boolean;
};

type ApiMeKey = {
  _id: string;
  name: string;
  isAgencyScoped?: boolean;
  isTestMode?: boolean;
  scopes: string[];
};

type ApiLocationSub = {
  _id: string;
  publicId?: string;
  name: string;
  slug: string;
  type?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessWebsite?: string;
  industry?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  settings?: unknown;
};

export function mapApiMe(user: ApiMeUser, key: ApiMeKey) {
  return {
    id: user._id,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    email: user.email,
    jobTitle: user.jobTitle ?? null,
    timezone: user.timezone ?? null,
    isActive: user.isActive,
    key: {
      id: key._id,
      name: key.name,
      isAgencyScoped: key.isAgencyScoped === true,
      isTestMode: key.isTestMode === true,
      scopes: [...key.scopes],
    },
  };
}

export function mapApiLocation(sub: ApiLocationSub) {
  const settings =
    sub.settings && typeof sub.settings === 'object' && !Array.isArray(sub.settings)
      ? (sub.settings as Record<string, unknown>)
      : {};
  const timezone = typeof settings.timezone === 'string' ? settings.timezone : null;
  return {
    id: sub._id,
    locationId: sub.publicId ?? null,
    name: sub.name,
    slug: sub.slug,
    type: sub.type ?? 'standard',
    timezone,
    businessEmail: sub.businessEmail ?? null,
    businessPhone: sub.businessPhone ?? null,
    businessWebsite: sub.businessWebsite ?? null,
    industry: sub.industry ?? null,
    address: sub.address
      ? {
          street: sub.address.street ?? null,
          city: sub.address.city ?? null,
          state: sub.address.state ?? null,
          zip: sub.address.zip ?? null,
          country: sub.address.country ?? null,
        }
      : null,
  };
}

/** Used by GET /api/v1/ext/seedly-mcp/me when the host has no GET /api/v1/me. */
export const getMe = internalQuery({
  args: { apiKeyId: v.id('apiKeys') },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.apiKeyId);
    if (!key) return null;
    const user = await ctx.db.get(key.createdBy);
    if (!user) return null;
    return mapApiMe(user, key);
  },
});

/** Used by GET /api/v1/ext/seedly-mcp/location when the host has no GET /api/v1/location. */
export const getLocation = internalQuery({
  args: {
    agencyId: v.id('agencies'),
    subAccountId: v.id('subAccounts'),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subAccountId);
    if (!sub || sub.agencyId !== args.agencyId || !sub.isActive) return null;
    return mapApiLocation(sub);
  },
});
