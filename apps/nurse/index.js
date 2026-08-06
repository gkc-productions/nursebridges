import "react-native-url-polyfill/auto";
import React from "react";
import { registerRootComponent } from "expo";
import App from "../mobile/App";

function NurseBridgesCareApp() {
  return React.createElement(App, { product: "nurse" });
}

registerRootComponent(NurseBridgesCareApp);
