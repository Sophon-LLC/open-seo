import { createAuthClient } from "better-auth/react";
import { apiKeyClient } from "@better-auth/api-key/client";
import {
  genericOAuthClient,
  inferAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { captureClientEvent, resetAnalyticsUser } from "@/client/lib/posthog";
import { userAdditionalFields } from "@/lib/auth-options";
import { orgAccessControl, orgRoles } from "@/lib/org-permissions";
import { getSignInHrefForLocation } from "@/lib/auth-redirect";
import { isHostedClientAuthMode } from "@/lib/auth-mode";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
  plugins: [
    apiKeyClient(),
    // ac/roles must match the server plugin exactly, otherwise the client's
    // synchronous checkRolePermission evaluates against the defaults and
    // disagrees with the server.
    organizationClient({ ac: orgAccessControl, roles: orgRoles }),
    genericOAuthClient(),
    inferAdditionalFields({ user: userAdditionalFields }),
  ],
});

// Self-hosted authentication is resolved on the server, not by Better Auth.
// Its /api/auth/* routes intentionally return 404. Keep the absent session
// explicit (no synthetic user), without subscribing or refetching that API.
const SELF_HOSTED_SESSION: ReturnType<typeof authClient.useSession> = {
  data: null,
  error: null,
  isPending: false,
  isRefetching: false,
  refetch: async () => {},
};

// AUTH_MODE is a build-time contract, so the selected hook cannot change
// between renders. Hosted mode retains Better Auth's unmodified lifecycle.
export const useSession: typeof authClient.useSession = isHostedClientAuthMode()
  ? authClient.useSession
  : () => SELF_HOSTED_SESSION;

export function signOutAndRedirect() {
  const signInHref = getSignInHrefForLocation(window.location);
  captureClientEvent("auth:sign_out");
  resetAnalyticsUser();
  void authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.assign(signInHref);
      },
    },
  });
}
