import fs from "node:fs";
import path from "node:path";

const mobileRoot = process.cwd();
const podfilePath = path.join(mobileRoot, "ios", "Podfile");
const projectPath = path.join(mobileRoot, "ios", "NurseBridge.xcodeproj", "project.pbxproj");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeIfChanged(filePath, next) {
  const current = read(filePath);
  if (current === next) return false;
  fs.writeFileSync(filePath, next);
  return true;
}

function repairPodfile() {
  let text = read(podfilePath);

  text = text.replace(
    /platform :ios, podfile_properties\['ios\.deploymentTarget'\] \|\| '[^']+'/,
    "platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'"
  );

  if (!text.includes("IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'")) {
    text = text.replace(
      /(\s+react_native_post_install\([\s\S]*?\n\s+\))/,
      `$1

    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
      end
    end`
    );
  }

  if (!text.includes("get-app-config-ios.sh") || !text.includes("phase.shell_script.gsub")) {
    text = text.replace(
      /(\s+installer\.pods_project\.targets\.each do \|target\|[\s\S]*?\n\s+end\n)/,
      `$1
    installer.pods_project.targets.each do |target|
      target.shell_script_build_phases.each do |phase|
        next unless phase.shell_script&.include?('get-app-config-ios.sh')

        phase.shell_script = phase.shell_script.gsub(
          'bash -l -c "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"',
          'bash -l -c \'"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"\''
        )
      end
    end
`
    );
  }

  return writeIfChanged(podfilePath, text);
}

function repairProject() {
  let text = read(projectPath);
  const bad = "`\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\"`";
  const good = "REACT_NATIVE_XCODE_SCRIPT=\\\"$(\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\")\\\"\\n/bin/sh \\\"$REACT_NATIVE_XCODE_SCRIPT\\\"";
  text = text.replace(bad, good);
  return writeIfChanged(projectPath, text);
}

const podfileChanged = repairPodfile();
const projectChanged = repairProject();

console.log(JSON.stringify({
  podfileChanged,
  projectChanged
}, null, 2));
