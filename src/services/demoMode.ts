import { cookies } from "next/headers";

/**
 * Checks whether the app is currently running in Demo Mode.
 * This checks the "chiefos_mode" cookie value.
 */
export async function isDemoMode(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const mode = cookieStore.get("chiefos_mode")?.value;
    return mode === "demo";
  } catch (e) {
    // cookies() can throw in certain server contexts where headers aren't available
    return false;
  }
}
