import "react-native-url-polyfill/auto";
import { registerRootComponent } from "expo";
import { LogBox } from "react-native";
import App from "./App";

// Supabase removes a locally persisted session when its one-time refresh token
// has already been consumed. In development React Native promotes auth-js's
// recovery log to a full-screen LogBox even though the client safely signs out.
LogBox.ignoreLogs(["AuthApiError: Invalid Refresh Token: Refresh Token Not Found"]);

registerRootComponent(App);
