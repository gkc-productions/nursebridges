import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import type { Session } from "@supabase/supabase-js";

export async function registerForPushNotificationsAsync(
  session: Session | null,
  baseUrl: string
): Promise<void> {
  if (!Device.isDevice) {
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  if (!session) return;

  await fetch(`${baseUrl}/devices/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      expo_push_token: token,
      platform: Device.osName ?? "unknown"
    })
  });
}
