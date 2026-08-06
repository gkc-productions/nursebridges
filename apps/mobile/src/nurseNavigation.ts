import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

export type NurseWorkspaceTab = "home" | "find" | "schedule" | "inbox" | "account";

export type NurseWorkspaceTabDefinition = {
  key: NurseWorkspaceTab;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  activeIcon: ComponentProps<typeof Ionicons>["name"];
};

export const NURSE_WORKSPACE_TABS: NurseWorkspaceTabDefinition[] = [
  { key: "home", label: "Home", icon: "home-outline", activeIcon: "home" },
  { key: "find", label: "Find Work", icon: "search-outline", activeIcon: "search" },
  { key: "schedule", label: "Schedule", icon: "calendar-outline", activeIcon: "calendar" },
  { key: "inbox", label: "Inbox", icon: "chatbubble-ellipses-outline", activeIcon: "chatbubble-ellipses" },
  { key: "account", label: "Account", icon: "person-circle-outline", activeIcon: "person-circle" }
];

export function getNurseWorkspaceTitle(tab: NurseWorkspaceTab) {
  switch (tab) {
    case "find":
      return "Find care work";
    case "schedule":
      return "Your schedule";
    case "inbox":
      return "Inbox";
    case "account":
      return "Professional profile";
    default:
      return "Your workday";
  }
}
