import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import type { Session } from "@supabase/supabase-js";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function registerForPushNotificationsAsync(
  session: Session | null,
  baseUrl: string
): Promise<void> {
  if (!session || !baseUrl || !Device.isDevice) {
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

  let token: string;
  try {
    token = (
      await Notifications.getExpoPushTokenAsync(
        Constants.easConfig?.projectId ? { projectId: Constants.easConfig.projectId } : undefined
      )
    ).data;
  } catch {
    return;
  }

  try {
    await fetch(`${baseUrl}/push/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        expo_push_token: token,
        platform: Device.osName ?? "unknown",
        device_name: Device.deviceName ?? undefined
      })
    });
  } catch {
    return;
  }
}

export function addForegroundNotificationListener() {
  return Notifications.addNotificationReceivedListener((notification) => {
    const content = notification.request.content;
    console.log("foreground notification received", {
      title: content.title,
      body: content.body,
      data: content.data
    });
  });
}
